// Base64 for bytes, in browsers, Workers and Node alike (`btoa`/`atob`; Uint8Array's own base64 methods aren't in
// Node 22). Images in LLM requests, fingerprints' thumbnails, service-account keys and tokens.

// The base64 of some bytes. In chunks: `String.fromCharCode` takes only so many arguments.
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

// The bytes of a base64 text (whitespace inside it isn't allowed: strip it first).
export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Base64url without padding (RFC 4648 §5, as JWTs have it), of bytes or of a text's UTF-8.
export function toBase64Url(data: string | Uint8Array): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
