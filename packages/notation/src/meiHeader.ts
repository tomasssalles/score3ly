// The MEI file's header (docs/notation.md, "MEI"; docs/stages/analyze.md, "The metadata"): the metadata as the header
// takes it, the header itself (`meiHead`, a system alone getting only its titles and people), and a piece's title, the
// same in the header's work and in the music's `mdiv`. Part of the builder (mei.ts).

import { el, type XmlElement } from "./xml.ts";
import type { Score } from "./score.ts";

// The metadata as the header needs it (`analyze`'s or `fix_metadata`'s, without pages and confidences).
export type MeiMetadata = {
  titles: { text: string; type: "main" | "subtitle" | "alternative" | "translated" }[];
  people: { name: string; role: "composer" | "arranger" | "editor" | "lyricist" | "librettist" | "translator" | "other" }[];
  pieces: { title: string; system: number }[];
  catalogueNumbers?: { text: string }[];
  dedications?: { text: string }[];
  instrumentation?: { text: string }[];
  compositionDates?: { text: string }[];
  publishers?: { text: string }[];
  places?: { text: string }[];
  dates?: { text: string }[];
  plateNumbers?: { text: string }[];
  notices?: { text: string }[];
  comments?: { text: string }[];
};

// A piece's title, the same in the header's `work` and the music's `mdiv`: the metadata's piece starting at its first
// system, trimmed (the first, should two start there: `analyze` and `fix_metadata` refuse that); none when there is
// no such piece or its title is empty.
export function pieceTitle(metadata: MeiMetadata | null | undefined, system: number): string | undefined {
  return metadata?.pieces.find((p) => p.system === system)?.title.trim() || undefined;
}

// How the file was made (`encodingDesc/appInfo`).
export type MeiApplication = { name: string; version: string; url: string };

const TITLE_TYPES: Record<MeiMetadata["titles"][number]["type"], string> = { main: "main", subtitle: "subordinate", alternative: "alternative", translated: "translated" };

export function meiHead(score: Score, m: MeiMetadata | null, app: MeiApplication | null, full: boolean): XmlElement {
  const texts = (list: { text: string }[] | undefined) => (list ?? []).map((t) => t.text.trim()).filter(Boolean);
  const titles = (m?.titles ?? []).filter((t) => t.text.trim());
  const titleEls = () =>
    titles.length > 0 ? titles.map((t) => el("title", { type: TITLE_TYPES[t.type] }, [t.text.trim()])) : [el("title", {}, ["Untitled"])];
  const people = (m?.people ?? []).filter((p) => p.name.trim());
  const named = (role: string) => people.filter((p) => p.role === role).map((p) => p.name.trim());
  const respStmt = (roles: string[]) => {
    const list = people.filter((p) => roles.includes(p.role));
    return list.length ? el("respStmt", {}, list.map((p) => el("persName", { role: p.role }, [p.name.trim()]))) : null;
  };
  const fileDesc = el("fileDesc", {}, [
    el("titleStmt", {}, [
      ...titleEls(),
      ...named("composer").map((n) => el("composer", {}, [n])),
      ...named("lyricist").map((n) => el("lyricist", {}, [n])),
      ...named("arranger").map((n) => el("arranger", {}, [n])),
      respStmt(["librettist", "translator", "editor", "other"]),
    ]),
    el("pubStmt"),
    full && texts(m?.comments).length ? el("notesStmt", {}, texts(m?.comments).map((t) => el("annot", {}, [t]))) : null,
  ]);
  if (!full) return el("meiHead", {}, [fileDesc]);

  const encodingDesc = app
    ? el("encodingDesc", {}, [el("appInfo", {}, [el("application", { version: app.version }, [el("name", {}, [app.name]), el("ptr", { target: app.url })])])])
    : null;
  const creation = [...texts(m?.dedications).map((t) => el("dedication", {}, [t])), ...texts(m?.compositionDates).map((t) => el("date", {}, [t]))];
  const work = el("work", { "xml:id": "work" }, [
    ...texts(m?.catalogueNumbers).map((t) => el("identifier", {}, [t])),
    ...titleEls(),
    ...named("composer").map((n) => el("composer", {}, [n])),
    ...named("lyricist").map((n) => el("lyricist", {}, [n])),
    ...named("librettist").map((n) => el("librettist", {}, [n])),
    ...named("arranger").map((n) => el("arranger", {}, [n])),
    ...named("translator").map((n) => el("contributor", { role: "translator" }, [n])),
    creation.length ? el("creation", {}, creation) : null,
    texts(m?.instrumentation).length ? el("perfMedium", {}, [el("perfResList", {}, texts(m?.instrumentation).map((t) => el("perfRes", {}, [t])))]) : null,
    score.pieces.length > 1 || (m?.pieces.length ?? 0) > 0
      ? el(
          "componentList",
          {},
          score.pieces.map((p) => el("work", { "xml:id": `work-piece-${p.index + 1}` }, [el("title", {}, [pieceTitle(m, p.systems[0].number) ?? `Piece ${p.index + 1}`])])),
        )
      : null,
  ]);
  const plate = texts(m?.plateNumbers);
  const pub = [...texts(m?.publishers).map((t) => el("publisher", {}, [t])), ...texts(m?.places).map((t) => el("pubPlace", {}, [t])), ...texts(m?.dates).map((t) => el("date", {}, [t]))];
  const notices = texts(m?.notices);
  const manifestation = el("manifestation", {}, [
    el("titleStmt", {}, [...titleEls(), respStmt(["editor", "other"])]),
    pub.length ? el("pubStmt", {}, pub) : null,
    notices.length ? el("availability", {}, notices.map((t) => el("useRestrict", {}, [t]))) : null,
    plate.length ? el("physDesc", {}, plate.map((t) => el("plateNum", {}, [t]))) : null,
  ]);
  return el("meiHead", {}, [fileDesc, encodingDesc, el("workList", {}, [work]), el("manifestationList", {}, [manifestation])]);
}
