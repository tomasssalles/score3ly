import { sha256Hex } from "@score3ly/core";

// Stores bytes under a key with their SHA-256, which the store checks (R2, and the desktop's folder). "mismatch" when
// the bytes don't match the hash, which the caller refuses (400); any other failure (a full disk, R2 unavailable) is
// thrown, and answered as the server's failure (500), not as a mismatch (the code review's E8). The hash is computed
// here only after a failure, so a stored object costs no CPU time for it.
export async function putChecked(bucket: R2Bucket, key: string, bytes: ArrayBuffer, sha256: string, options: R2PutOptions = {}): Promise<"mismatch" | null> {
  try {
    await bucket.put(key, bytes, { ...options, sha256 });
    return null;
  } catch (err) {
    if ((await sha256Hex(bytes)) !== sha256) return "mismatch";
    throw err;
  }
}
