// Verovio's types are the web app's (apps/web/src/verovio.d.ts, in this package's tsconfig).

// svg-to-pdfkit ships no types.
declare module "svg-to-pdfkit" {
  const SVGtoPDF: (
    doc: PDFKit.PDFDocument,
    svg: string,
    x: number,
    y: number,
    options?: { width?: number; height?: number; warningCallback?: (warning: string) => void },
  ) => void;
  export default SVGtoPDF;
}
