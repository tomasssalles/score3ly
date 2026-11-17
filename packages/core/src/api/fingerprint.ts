// An image's fingerprint (docs/images.md §8.3): its size, a hash of its raw pixels, a small thumbnail, made by
// `@score3ly/imaging`, and stored by the Worker for the images stored results were computed from
// (`GET /api/fingerprints/<recipe key>`, `POST /api/fingerprints`).

export type Fingerprint = {
  version: number; // imaging's FINGERPRINT_VERSION: fingerprints of another version aren't compared
  width: number;
  height: number;
  pixelsSha256: string; // of the raw RGBA pixels, as decoded (not of the PNG file: encoders differ)
  thumbnail: string; // base64 of the grayscale thumbnail, row by row
  thumbnailWidth: number;
  thumbnailHeight: number;
};

// A fingerprint as the Worker stores it: by the image's recipe key, with the PDF it was made from.
export type StoredFingerprint = Fingerprint & { recipeKey: string; pdfSha256: string };
