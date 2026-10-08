// Access tokens for Google Cloud from a service account's key file, made with WebCrypto, so it runs in a Worker.
// Google's own auth library expects Node (files, child processes, the metadata server), which a Worker doesn't
// have. The flow is Google's "service account JWT" grant: sign a short claim with the account's private key,
// exchange it for an access token at the token endpoint, and reuse that token until shortly before it expires.

import { type Fetch, LlmError } from "./types.ts";

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

// What the Vertex SDK asks of an auth client: request headers with a valid token, and the project.
export type TokenSource = {
  projectId: string;
  getRequestHeaders(): Promise<Headers>;
};

export function tokenSource(
  account: ServiceAccount,
  fetchFn: Fetch = fetch,
  now: () => number = Date.now,
): TokenSource {
  let cached: { token: string; expiresAt: number } | null = null;
  let pending: Promise<string> | null = null;

  async function fetchToken(): Promise<string> {
    const issuedAt = Math.floor(now() / 1000);
    const assertion = await signJwt(account, issuedAt);
    const response = await fetchFn(account.tokenUri, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
    });
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
    projectId: account.projectId,
    async getRequestHeaders() {
      let token = cached && cached.expiresAt > now() ? cached.token : null;
      if (!token) {
        // Requests that need a token at the same time share one fetch.
        pending ??= fetchToken().finally(() => (pending = null));
        token = await pending;
      }
      return new Headers({ authorization: `Bearer ${token}` });
    },
  };
}

async function signJwt(account: ServiceAccount, issuedAt: number): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const claims = { iss: account.clientEmail, scope: SCOPE, aud: account.tokenUri, iat: issuedAt, exp: issuedAt + 3600 };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(account.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}

function pemToDer(pem: string): ArrayBuffer {
  const base64 = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return bytes.buffer;
}

function base64url(data: string | Uint8Array): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
