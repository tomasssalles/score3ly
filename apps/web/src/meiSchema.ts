// Validating MEI against its schema with libxml2 (WebAssembly): the RelaxNG schema is compiled once (about a second
// for MEI 5.1's), then each check takes only what the file needs (docs/stages/engrave.md). Verovio is no check:
// it loads what the schema refuses and leaves out what it doesn't know, silently.

import { RelaxNGValidator, XmlDocument, XmlElement, XmlParseError, XmlValidateError, type XmlLibError } from "libxml2-wasm";
import type { MeiElement, MeiProblem, Validated } from "./meiChecks.ts";

const problemsOf = (error: XmlLibError, syntax: boolean): MeiProblem[] =>
  (error.details ?? []).map((d) => ({ line: d.line > 0 ? d.line : null, message: d.message.trim(), ...(syntax ? { syntax: true as const } : {}) }));

// Every element of the document, in document order, with its attributes (meiChecks.ts checks the ids on them).
function elementsOf(root: XmlElement): MeiElement[] {
  const elements: MeiElement[] = [];
  const walk = (e: XmlElement) => {
    elements.push({ line: e.line, attrs: e.attrs.map((a) => ({ name: a.prefix ? `${a.prefix}:${a.name}` : a.name, value: a.value })) });
    for (let child = e.firstChild; child; child = child.next) if (child instanceof XmlElement) walk(child);
  };
  walk(root);
  return elements;
}

export function meiValidator(rng: string): (text: string) => Validated {
  const validator = RelaxNGValidator.fromDoc(XmlDocument.fromString(rng));
  return (text) => {
    let doc: XmlDocument;
    try {
      doc = XmlDocument.fromString(text);
    } catch (err) {
      if (err instanceof XmlParseError) return { problems: problemsOf(err, true), elements: [] };
      throw err;
    }
    try {
      let problems: MeiProblem[] = [];
      try {
        validator.validate(doc);
      } catch (err) {
        if (err instanceof XmlValidateError) problems = problemsOf(err, false);
        else throw err;
      }
      return { problems, elements: elementsOf(doc.root) };
    } finally {
      doc.dispose();
    }
  };
}
