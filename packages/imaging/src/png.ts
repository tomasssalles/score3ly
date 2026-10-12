// PNG files of our images, encoded and decoded by our own code (DESIGN.md §8.6): the device's image cache stores
// page images as PNG, lossless and much smaller than raw pixels for line art. Compression is the platform's
// (CompressionStream "deflate" is the zlib format PNG wants), available in browsers, their Web Workers and Node.
// The decoder reads what the encoder writes (8-bit RGBA, not interlaced), with any of PNG's row filters.

import type { RgbaImage } from "./image.ts";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export async function encodePng(image: RgbaImage): Promise<Uint8Array<ArrayBuffer>> {
  const { width, height, data } = image;
  const stride = width * 4;
  // Each row starts with its filter type: "Up" (the difference to the row above) suits scans and line art.
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const out = y * (stride + 1);
    const row = y * stride;
    raw[out] = 2;
    for (let x = 0; x < stride; x++) {
      raw[out + 1 + x] = data[row + x] - (y > 0 ? data[row - stride + x] : 0);
    }
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA, deflate, adaptive filtering, not interlaced
  const compressed = await transform(raw, new CompressionStream("deflate"));
  return concat([
    new Uint8Array(SIGNATURE),
    chunk("IHDR", header),
    chunk("IDAT", compressed),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

export async function decodePng(bytes: Uint8Array): Promise<RgbaImage> {
  if (!SIGNATURE.every((b, i) => bytes[i] === b)) throw new Error("not a PNG file");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  const parts: Uint8Array[] = [];
  for (let at = 8; at < bytes.length; ) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      const [depth, color, , , interlace] = body.subarray(8);
      if (depth !== 8 || color !== 6 || interlace !== 0) throw new Error("only 8-bit RGBA PNGs without interlacing");
    } else if (type === "IDAT") {
      parts.push(body);
    } else if (type === "IEND") {
      break;
    }
    at += 12 + length;
  }
  const raw = await transform(concat(parts), new DecompressionStream("deflate"));
  const stride = width * 4;
  const data = new Uint8ClampedArray(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? data[row + x - 4] : 0;
      const up = y > 0 ? data[row - stride + x] : 0;
      const upLeft = x >= 4 && y > 0 ? data[row - stride + x - 4] : 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (left + up) >> 1;
      else if (filter === 4) predicted = paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`unknown PNG filter ${filter}`);
      data[row + x] = (line[x] + predicted) & 255;
    }
  }
  return { width, height, data };
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const output = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
}

function chunk(type: string, body: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
