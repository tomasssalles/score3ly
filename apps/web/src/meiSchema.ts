// Validating MEI against its schema with libxml2 (WebAssembly): the RelaxNG schema is compiled once (about a second
// for MEI 5.1's), then each check takes only what the file needs (DESIGN.md §6, `final_touches`). Verovio is no check:
// it loads what the schema refuses and leaves out what it doesn't know, silently.

import { RelaxNGValidator, XmlDocument, XmlParseError, XmlValidateError } from "libxml2-wasm";
import type { MeiProblem } from "./meiChecks.ts";

type Details = { details?: { message: string; line: number }[] };

const problemsOf = (error: Details, syntax: boolean): MeiProblem[] =>
  (error.details ?? []).map((d) => ({ line: d.line > 0 ? d.line : null, message: d.message.trim(), ...(syntax ? { syntax: true as const } : {}) }));

export function meiValidator(rng: string): (text: string) => MeiProblem[] {
  const validator = RelaxNGValidator.fromDoc(XmlDocument.fromString(rng));
  return (text) => {
    let doc: XmlDocument;
    try {
      doc = XmlDocument.fromString(text);
    } catch (err) {
      if (err instanceof XmlParseError) return problemsOf(err as Details, true);
      throw err;
    }
    try {
      validator.validate(doc);
      return [];
    } catch (err) {
      if (err instanceof XmlValidateError) return problemsOf(err as Details, false);
      throw err;
    } finally {
      doc.dispose();
    }
  };
}
