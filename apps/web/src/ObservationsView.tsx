// The observations (DESIGN.md §6): `analyze`'s and a finished `fix_observations`'s, read-only, and a WIP
// `fix_observations`'s form. Both list the items of the whole score, then page by page, each with its places by name
// ("system 17, stretch 3"), an eye and its confidence. The eye opens the pages with the layout's boxes, the item's
// system in the middle, with only that item in a strip above them. In the form, every item has a "⋮" with Edit,
// Confirm (Unconfirm) and Remove, and a system's staves also "Add a staff above" and the like; one "+" adds any kind
// of item. Places are picked, never typed: a system, then one of its positions. Saving as in `fix_metadata`
// (fieldList.tsx).

import type { Place } from "@score3ly/prompts";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { placeLabel } from "./analyze";
import { fetchJsonContent, recordOutputs, type Project } from "./api";
import { LayoutFilmstrip } from "./ArtifactView";
import { DropdownMenu, type MenuItem } from "./DropdownMenu";
import { Confidence, fieldActions, FieldStrip, Picker, useFieldList, type Editing } from "./fieldList";
import { observationsOutput } from "./finishFixObservations";
import {
  addStaff,
  fitStaff,
  inSystem,
  newRow,
  normalizeObservations,
  OBS_KINDS,
  OBS_SECTIONS,
  obsKindOf,
  obsProblem,
  observationsOf,
  positionLabel,
  positionsIn,
  removeProblem,
  removeStaff,
  reportedSystems,
  rowEmpty,
  rowsOf,
  sameItem,
  samePlace,
  sameShapeKinds,
  sectionsOf,
  shownConfidence,
  stavesOf,
  stavesPickable,
  staffSystems,
  withPlace,
  type ObsRow,
  type ScoreSystems,
} from "./fixObservations";
import { CheckIcon, EyeIcon, MoreIcon, PlusIcon } from "./icons";
import type { PageLayout } from "./layout";
import type { Artifact } from "./pipeline";

export function ObservationsView({ project, artifact, onEdited }: { project: Project; artifact: Artifact; onEdited?: () => void }) {
  const analysis = artifact.analysis!;
  const parent = analysis.parents?.observations;
  const editor = artifact.editor?.step === "fix_observations" && parent ? artifact.editor : null;
  const pages = (artifact.pages ?? []).flatMap((p) => (p.layoutSha256 ? [{ ...p, layoutSha256: p.layoutSha256 }] : []));
  const pageNumbers = pages.map((p) => p.page);
  const [systems, setSystems] = useState<ScoreSystems>([]);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const list = useFieldList<ObsRow>(
    { sha256: analysis.sha256, load: async () => rowsOf(normalizeObservations(await fetchJsonContent(analysis.sha256))) },
    editor && {
      stageId: editor.stageId,
      save: async (rows) => {
        await recordOutputs(project, editor.stageId, [await observationsOutput(observationsOf(rows, pageNumbers), parent!)]);
        onEdited?.();
      },
    },
    { empty: rowEmpty, problem: (draft, others) => obsProblem(draft, others, systems), same: sameItem },
  );
  const { rows, editing, focus } = list;

  // The systems, numbered across the pages, with their pages and bar lines: what places are picked from.
  useEffect(() => {
    if (!editor) return;
    let cancelled = false;
    Promise.all(pages.map((p) => fetchJsonContent(p.layoutSha256) as Promise<PageLayout>)).then(
      (layouts) =>
        !cancelled && setSystems(layouts.flatMap((l, i) => l.systems.map((s) => ({ page: pages[i].page, barLines: s.barLines.length })))),
      () => !cancelled && setLayoutError("The layout couldn't be loaded."),
    );
    return () => {
      cancelled = true;
    };
  }, [analysis.sha256]);

  const error = list.error ?? layoutError;
  if (!rows) return <div className="text-view"><p>{error ?? "Loading…"}</p></div>;

  const field = (index: number) => {
    const row = rows[index];
    if (editing?.index === index) {
      return (
        <ItemEditor
          key={index}
          editing={editing}
          rows={rows}
          systems={systems}
          pages={pageNumbers}
          onChange={list.setDraft}
          onDone={list.finishEditing}
          onCancel={list.cancelEditing}
        />
      );
    }
    const staves: MenuItem[] =
      row.list === "systems" && row.system !== null
        ? [
            { label: "Add a staff above", onSelect: () => list.act(index, (rows, i) => addStaff(rows, i, "above", systems)) },
            { label: "Add a staff below", onSelect: () => list.act(index, (rows, i) => addStaff(rows, i, "below", systems)) },
            { label: "Remove the top staff", onSelect: () => list.act(index, (rows, i) => removeStaff(rows, i, "top", systems)) },
            { label: "Remove the bottom staff", onSelect: () => list.act(index, (rows, i) => removeStaff(rows, i, "bottom", systems)) },
          ]
        : [];
    return (
      <Item
        key={index}
        row={row}
        onOpen={focus === null ? () => list.setFocus(index) : undefined}
        actions={
          editor && {
            groups: fieldActions(
              row,
              {
                edit: () => list.edit(index),
                confirm: () => list.confirm(index, !row.confirmed),
                remove: () => list.remove(index, (rows, i) => removeProblem(rows, i, systems)),
              },
              staves,
            ),
          }
        }
      />
    );
  };

  if (focus !== null && rows[focus]) {
    const row = rows[focus];
    return (
      <FieldStrip field={field(focus)} editing={editing?.index === focus} onClose={() => list.setFocus(null)}>
        <LayoutFilmstrip key={focus} pages={pages} focusSystem={focusSystem(row, pages, systems)} />
      </FieldStrip>
    );
  }

  const sections = sectionsOf(rows);
  return (
    <div className="text-view analysis">
      {editor && (
        <div className="metadata-tools">
          {error && <p className="field-problem">{error}</p>}
          <DropdownMenu
            icon={<PlusIcon />}
            label="Add an item"
            className="metadata-add"
            groups={OBS_SECTIONS.map((s) =>
              OBS_KINDS.filter((k) => k.section === s).map((k) => ({
                label: k.label,
                onSelect: () => list.add((rows) => newRow(k, rows, systems, pageNumbers)),
              })),
            )}
            headings={OBS_SECTIONS}
          />
        </div>
      )}
      {sections.length === 0 && <p className="muted">{editor ? "No observations yet: add items with +." : "Nothing was observed."}</p>}
      {sections.map((section) => (
        <section key={section.title}>
          <h3>{section.title}</h3>
          <ul>{section.indices.map(field)}</ul>
        </section>
      ))}
    </div>
  );
}

// The system the pages open at for an item: its first place's, else the first on its page (none for the whole
// score's items without a place).
function focusSystem(row: ObsRow, pages: { page: number; layoutSha256: string }[], systems: ScoreSystems): number | undefined {
  const place = row.place ?? row.start ?? row.end ?? row.places[0];
  if (place) return place.system;
  if (row.system !== null) return row.system;
  const first = systems.findIndex((s) => s.page === row.page);
  return first >= 0 ? first + 1 : undefined;
}

const at = (p: Place) => <span className="page-link static">{placeLabel(p)}</span>;
const staff = (row: ObsRow) => row.staff && <span className="staff">staff {row.staff.number}/{row.staff.of}</span>;

// What an item says, as read.
function body(row: ObsRow) {
  const span = (
    <>
      {row.start ? <>from {at(row.start)}</> : "from the previous page"} {row.end ? <>to {at(row.end)}</> : "on to the next page"}
    </>
  );
  switch (row.list) {
    case "systems":
      return (
        <>
          {row.system !== null && <span className="page-link static">system {row.system}</span>} {row.staves} staves
          {row.instruments.some((s) => s) && `: ${row.instruments.map((s) => s || "?").join(", ")}`}
        </>
      );
    case "changes":
      return (
        <>
          {row.text} {staff(row)} {row.place && at(row.place)}
        </>
      );
    case "ottavas":
      return (
        <>
          {row.text} {staff(row)} {span}
        </>
      );
    case "specialBarLines":
      return row.place && at(row.place);
    case "endings":
      return (
        <>
          {row.text} {span}
        </>
      );
    case "directions":
      return (
        <>
          {row.text} {row.place && at(row.place)}
        </>
      );
    case "recurringMaterial":
      return (
        <>
          {row.text}{" "}
          {row.places.map((p, i) => (
            <span key={i}>{at(p)} </span>
          ))}
        </>
      );
    default:
      return row.text;
  }
}

function Item({ row, onOpen, actions }: { row: ObsRow; onOpen?: () => void; actions: { groups: MenuItem[][] } | null }) {
  const label = obsKindOf(row).label;
  return (
    <li className="analysis-row metadata-row obs-row">
      <span className="field-label">{label}</span>
      <span className="field-text">{body(row)}</span>
      {onOpen ? (
        <button type="button" className="icon-button field-open" aria-label="Show in the score" title="Show in the score" onClick={onOpen}>
          <EyeIcon />
        </button>
      ) : (
        <span />
      )}
      <Confidence value={shownConfidence(row)} />
      {actions && <DropdownMenu icon={<MoreIcon />} label={`${label}: actions`} className="field-actions" groups={actions.groups} />}
    </li>
  );
}

// An item in edit mode: its kind (where its list has kinds) and the ✓; its places, staff, staves or page, each a line
// of pickers; then its text (a system's instruments, one per staff).
function ItemEditor({
  editing,
  rows,
  systems,
  pages,
  onChange,
  onDone,
  onCancel,
}: {
  editing: Editing<ObsRow>;
  rows: ObsRow[];
  systems: ScoreSystems;
  pages: number[];
  onChange: (draft: ObsRow) => void;
  onDone: () => boolean;
  onCancel: () => void;
}) {
  const row = editing.draft;
  const text = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => text.current?.focus(), []);
  const kinds = sameShapeKinds(row);
  // The other items as they are, for the staves the draft's system has.
  const others = rows.filter((_, i) => i !== editing.index);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
    } else if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
      e.preventDefault();
      onDone();
    }
  }

  // The systems by page, for a picker: `pick` gets the system's number.
  const systemGroups = (current: number | null, pick: (n: number) => void, disabled?: Set<number>) => {
    const byPage = pages.map((page) => ({
      page,
      items: systems.flatMap((s, i) =>
        s.page === page ? [{ label: String(i + 1), current: i + 1 === current, disabled: disabled?.has(i + 1), onSelect: () => pick(i + 1) }] : [],
      ),
    }));
    const shown = byPage.filter((g) => g.items.length > 0);
    return { groups: shown.map((g) => g.items), headings: shown.map((g) => `Page ${g.page}`) };
  };

  // A place: a system, then one of its positions. For a span's end, "–" leaves it open.
  const placeLine = (label: string, place: Place | null, set: (p: Place | null) => void, options: { open?: string; barLinesOnly?: boolean } = {}) => {
    const { groups, headings } = systemGroups(place?.system ?? null, (n) =>
      set(place ? inSystem(place, n, systems, options.barLinesOnly) : { system: n, at: "start", number: 0 }),
    );
    const open: MenuItem[] = options.open ? [{ label: `– (${options.open})`, current: place === null, onSelect: () => set(null) }] : [];
    return (
      <div className="field-edit-line">
        <span className="field-edit-label">{label}</span>
        <Picker
          value={place ? `system ${place.system}` : "–"}
          label={`${label}: system`}
          groups={options.open ? [open, ...groups] : groups}
          headings={options.open ? ["", ...headings] : headings}
          className="number-picker system-picker"
        />
        {place && (
          <Picker
            value={positionLabel(place)}
            label={`${label}: where in the system`}
            groups={[
              positionsIn(place.system, systems[place.system - 1]?.barLines ?? 0, options.barLinesOnly).map((p) => ({
                label: positionLabel(p),
                current: samePlace(p, place),
                onSelect: () => set(p),
              })),
            ]}
            className="position-picker"
          />
        )}
        {!place && options.open && <span className="field-edit-label">{options.open}</span>}
      </div>
    );
  };

  const set = (which: "place" | "start" | "end") => (p: Place | null) => onChange(withPlace(row, which, p, others, systems));

  // The staff, k/n with n the staves given for the item's system; a change's may be none.
  const staffLine = () => {
    const [system] = staffSystems(row, systems);
    const n = system === undefined ? null : stavesOf(others, system);
    const none: MenuItem[] = row.list === "changes" ? [{ label: "–", current: row.staff === null, onSelect: () => onChange({ ...row, staff: null }) }] : [];
    const choices = n === null ? [] : Array.from({ length: n }, (_, k) => k + 1);
    return (
      <div className="field-edit-line">
        <span className="field-edit-label">staff</span>
        <Picker
          value={row.staff ? `${row.staff.number}/${row.staff.of}` : "–"}
          label="Staff"
          groups={[
            [
              ...none,
              ...choices.map((k) => ({
                label: `${k}/${n}`,
                current: row.staff?.number === k,
                onSelect: () => onChange({ ...row, staff: { number: k, of: n! } }),
              })),
            ],
          ]}
          className="number-picker"
        />
        {n === null && <span className="field-edit-label">(the system's staves aren't given)</span>}
      </div>
    );
  };

  const input = (placeholder: string, multiline = false) =>
    multiline ? (
      <textarea
        ref={text}
        className="field-input"
        rows={2}
        value={row.text}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange({ ...row, text: e.target.value })}
      />
    ) : (
      <input
        ref={text}
        className="field-input"
        value={row.text}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange({ ...row, text: e.target.value })}
      />
    );

  let lines;
  switch (row.list) {
    case "systems": {
      const { groups, headings } = systemGroups(
        row.system,
        (n) => onChange({ ...row, system: n, page: systems[n - 1]?.page ?? row.page }),
        reportedSystems(rows, editing.index),
      );
      const pickable = stavesPickable(others, row.system, systems);
      lines = (
        <>
          <div className="field-edit-line">
            <span className="field-edit-label">system</span>
            <Picker value={row.system === null ? "–" : String(row.system)} label="System" groups={groups} headings={headings} className="number-picker system-picker" />
            <span className="field-edit-label">staves</span>
            <Picker
              value={String(row.staves)}
              label="Staves"
              groups={[
                Array.from({ length: 8 }, (_, k) => k + 1).map((k) => ({
                  label: String(k),
                  current: k === row.staves,
                  disabled: !pickable && k !== row.staves,
                  onSelect: () => onChange({ ...row, staves: k, instruments: Array.from({ length: k }, (_, j) => row.instruments[j] ?? "") }),
                })),
              ]}
              className="number-picker"
            />
          </div>
          {!pickable && <p className="field-hint">Something names its staves: add or remove staves with ⋮ instead.</p>}
          {row.instruments.map((instrument, k) => (
            <input
              key={k}
              ref={k === 0 ? text : undefined}
              className="field-input"
              value={instrument}
              placeholder={`Staff ${k + 1}: instrument`}
              aria-label={`Staff ${k + 1}: instrument`}
              onChange={(e) => onChange({ ...row, instruments: row.instruments.map((s, j) => (j === k ? e.target.value : s)) })}
            />
          ))}
        </>
      );
      break;
    }
    case "changes":
      lines = (
        <>
          {placeLine("at", row.place, set("place"))}
          {staffLine()}
          {input(row.kind === "key" ? "e.g. G major" : row.kind === "time" ? "e.g. 3/4" : row.kind === "clef" ? "e.g. bass" : "As printed")}
        </>
      );
      break;
    case "ottavas":
      lines = (
        <>
          {placeLine("from", row.start, set("start"), { open: "before the page" })}
          {placeLine("to", row.end, set("end"), { open: "after the page" })}
          {staffLine()}
          {input("e.g. 8va")}
        </>
      );
      break;
    case "specialBarLines":
      lines = placeLine("at", row.place, set("place"), { barLinesOnly: true });
      break;
    case "endings":
      lines = (
        <>
          {placeLine("from", row.start, set("start"), { open: "before the page" })}
          {placeLine("to", row.end, set("end"), { open: "after the page" })}
          {input("Numbers, e.g. 1.")}
        </>
      );
      break;
    case "directions":
      lines = (
        <>
          {placeLine("at", row.place, set("place"))}
          {input("e.g. D.C. al Fine")}
        </>
      );
      break;
    case "notes":
      lines = (
        <>
          <div className="field-edit-line">
            <span className="field-edit-label">p.</span>
            <Picker
              value={String(row.page)}
              label="Page"
              groups={[pages.map((p) => ({ label: String(p), current: p === row.page, onSelect: () => onChange({ ...row, page: p }) }))]}
              className="number-picker"
            />
          </div>
          {input("Note", true)}
        </>
      );
      break;
    case "recurringMaterial":
      lines = (
        <>
          {row.places.map((p, k) => (
            <div key={k} className="field-edit-places">
              {placeLine(k === 0 ? "at" : "and", p, (q) => onChange({ ...row, places: row.places.map((x, j) => (j === k ? q! : x)) }))}
              <button
                type="button"
                className="icon-button"
                aria-label="Remove this place"
                title="Remove this place"
                onClick={() => onChange({ ...row, places: row.places.filter((_, j) => j !== k) })}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="field-add-place"
            onClick={() => onChange({ ...row, places: [...row.places, { system: 1, at: "start", number: 0 }] })}
            disabled={systems.length === 0}
          >
            + place
          </button>
          {input("Description", true)}
        </>
      );
      break;
    default:
      lines = input(obsKindOf(row).label, true);
  }

  return (
    <li
      className="analysis-row editing"
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onDone();
      }}
    >
      <div className="field-edit-head">
        {kinds.length > 0 ? (
          <Picker
            value={obsKindOf(row).label}
            label="Kind of item"
            groups={[kinds.map((k) => ({ label: k.label, current: k.kind === row.kind, onSelect: () => onChange(fitStaff({ ...row, kind: k.kind }, others, systems)) }))]}
            className="field-kind-picker"
          />
        ) : (
          <span className="field-edit-kind">{obsKindOf(row).label}</span>
        )}
        <span className="field-edit-space" />
        <button type="button" className="field-done" aria-label="Done" title="Done" onClick={onDone}>
          <CheckIcon />
        </button>
      </div>
      {lines}
      {editing.problem && <p className="field-problem">{editing.problem}</p>}
    </li>
  );
}
