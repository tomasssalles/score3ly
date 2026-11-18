// Access tokens for Google Cloud from a service account's key file, made with WebCrypto, so it runs in a Worker.
// Google's own auth library expects Node (files, child processes, the metadata server), which a Worker doesn't
// have. The flow is Google's "service account JWT" grant: sign a short claim with the account's private key,
// exchange it for an access token at the token endpoint, and reuse that token until shortly before it expires.

import { fromBase64, toBase64Url } from "@score3ly/core";
import { type Fetch, kindForStatus, LlmError } from "./types.ts";

export type ServiceAccount = {
  clientEmail: string;
  privateKey: string; // PEM, PKCS #8
  projectId: string;
  tokenUri: string;
};

const SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";

// The service account in a key file (JSON) as Google Cloud downloads it.
export function parseServiceAccount(json: string): ServiceAccount {
  let key: Record<string, unknown>;
  try {
    key = JSON.parse(json);
  } catch {
    throw new LlmError("auth", "The service account key isn't valid JSON.");
  }
  const { type, client_email, private_key, project_id, token_uri } = key;
  if (type !== "service_account" || typeof client_email !== "string" || typeof private_key !== "string") {
    throw new LlmError("auth", "The service account key lacks its type, client_email or private_key.");
  }
  return {
    clientEmail: client_email,
    privateKey: private_key,
    projectId: typeof project_id === "string" ? project_id : "",
    tokenUri: typeof token_uri === "string" ? token_uri : DEFAULT_TOKEN_URI,
  };
}

// Request headers with a valid token. `signal`: the caller stops waiting (the fetch of a token is shared by the requests
// that need one at the same time, so it goes on for the others).
export type TokenSource = {
  getRequestHeaders(signal?: AbortSignal): Promise<Headers>;
};

// How long the token endpoint may take before the token's fetch is given up.
const TOKEN_TIMEOUT_MS = 30_000;

export function tokenSource(
  account: ServiceAccount,
  fetchFn: Fetch = fetch,
  now: () => number = Date.now,
  timeoutMs = TOKEN_TIMEOUT_MS,
): TokenSource {
  let cached: { token: string; expiresAt: number } | null = null;
  let pending: Promise<string> | null = null;

  async function fetchToken(): Promise<string> {
    const issuedAt = Math.floor(now() / 1000);
    const assertion = await signJwt(account, issuedAt);
    let response: Response;
    try {
      response = await fetchFn(account.tokenUri, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        throw new LlmError("timeout", `Google's token endpoint didn't answer within ${timeoutMs / 1000} s.`);
      }
      throw err;
    }
    // Refused (a 4xx): the account. The endpoint failing or busy (a 5xx, a 429): not the account's fault.
    if (response.status >= 500 || response.status === 429) {
      throw new LlmError(kindForStatus(response.status), `Google's token endpoint failed (HTTP ${response.status}).`, response.status);
    }
    if (!response.ok) {
      throw new LlmError("auth", `Google refused the service account (HTTP ${response.status}).`, response.status);
    }
    const { access_token, expires_in } = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!access_token) throw new LlmError("auth", "Google's token response has no access token.");
    // Renewed a minute early, so a token never expires during a request.
    cached = { token: access_token, expiresAt: now() + ((expires_in ?? 3600) - 60) * 1000 };
    return access_token;
  }

  return {
    async getRequestHeaders(signal) {
      let token = cached && cached.expiresAt > now() ? cached.token : null;
      if (!token) {
        // Requests that need a token at the same time share one fetch.
        pending ??= fetchToken().finally(() => (pending = null));
        token = await (signal ? untilAborted(pending, signal) : pending);
      }
      return new Headers({ authorization: `Bearer ${token}` });
    },
  };
}

// A promise, or the abort of `signal` first (an AbortError, as fetch's).
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException("This operation was aborted", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(new DOMException("This operation was aborted", "AbortError"));
    signal.addEventListener("abort", stop, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}

// The token source of a service account, kept between requests (decided 2026-11-09): the Worker makes an adapter for
// every LLM request, and a new token source each time would fetch a new token each time (100–300 ms). Kept per
// service account (its email, token endpoint and key) for as long as the Worker lives: always on the desktop, for the
// isolate's life on Cloudflare. Per `fetch` too, so that tests with fakes don't share tokens.
const shared = new WeakMap<object, Map<string, TokenSource>>();
const DEFAULT_FETCH = {};

export function sharedTokenSource(account: ServiceAccount, fetchFn?: Fetch): TokenSource {
  const bucket = fetchFn ?? DEFAULT_FETCH;
  let sources = shared.get(bucket);
  if (!sources) shared.set(bucket, (sources = new Map()));
  const key = `${account.clientEmail}\n${account.tokenUri}\n${account.privateKey}`;
  let source = sources.get(key);
  if (!source) {
    // Called on its own, never as a method of another object: the Workers runtime refuses that ("Illegal invocation").
    source = tokenSource(account, fetchFn ?? ((input, init) => fetch(input, init)));
    sources.set(key, source);
  }
  return source;
}

async function signJwt(account: ServiceAccount, issuedAt: number): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const claims = { iss: account.clientEmail, scope: SCOPE, aud: account.tokenUri, iat: issuedAt, exp: issuedAt + 3600 };
  const unsigned = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(account.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`;
}

function pemToDer(pem: string): ArrayBuffer {
  const base64 = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  return fromBase64(base64).buffer;
}

