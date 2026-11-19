// What engraving a page and making its PDF needs that doesn't need the browser or the rest of the app (docs/stages/engrave.md):
// the page sizes, Verovio's options for them, and the PDF's bytes made the same every time. No imports: the evaluation's
// engraver (apps/eval) uses the same options.

// The page size. The engraving always has Verovio's own breaks (docs/stages/engrave.md).
export type EngraveConfig = { pageSize: "a4" | "letter" };

export const DEFAULT_ENGRAVE_CONFIG: EngraveConfig = { pageSize: "a4" };

// Page sizes in millimetres (Verovio counts tenths of them).
export const PAGE_SIZES = {
  a4: { label: "A4", width: 210, height: 297 },
  letter: { label: "US Letter", width: 215.9, height: 279.4 },
} as const;

// Verovio's options for a page of the given size (its units are tenths of a millimetre).
export function pageOptions(config: EngraveConfig): Record<string, unknown> {
  const size = PAGE_SIZES[config.pageSize];
  return {
    breaks: "auto",
    pageWidth: Math.round(size.width * 10),
    pageHeight: Math.round(size.height * 10),
    scale: 40,
    footer: "none",
    svgViewBox: true,
  };
}

export function engraveConfigOf(stored: Record<string, unknown> | null): EngraveConfig {
  const pageSize = stored?.pageSize === "a4" || stored?.pageSize === "letter" ? stored.pageSize : DEFAULT_ENGRAVE_CONFIG.pageSize;
  return { pageSize };
}

// jsPDF always writes the creation date: it is overwritten with spaces, so every offset in the file stays right and
// the same recipe gives the same bytes.
export function withoutDate(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  const text = new TextDecoder("latin1").decode(bytes);
  const at = text.indexOf("/CreationDate (");
  if (at < 0) return bytes;
  const end = text.indexOf(")", at);
  bytes.fill(0x20, at, end + 1);
  return bytes;
}

// How many pages a PDF made by jsPDF has: its page objects.
export function pdfPageCount(text: string): number {
  return (text.match(/\/Type \/Page\b(?!s)/g) ?? []).length;
}
