// The parts of Verovio's JavaScript package the app uses (it ships no types).
declare module "verovio/wasm" {
  const createVerovioModule: () => Promise<unknown>;
  export default createVerovioModule;
}

declare module "verovio/esm" {
  export class VerovioToolkit {
    constructor(module: unknown);
    getVersion(): string;
    setOptions(options: Record<string, unknown>): void;
    loadData(data: string): boolean;
    renderToSVG(page: number): string;
    getPageCount(): number;
    getLog(): string;
  }
}
