import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "./icons";
import { configError, MAX_DPI, MIN_DPI, type RasterizeConfig } from "./rasterize";

// The config of `rasterize` (DESIGN.md §6): which pages, and the resolution for vector pages.
export function RasterizeConfigDialog({
  config,
  onSave,
  onCancel,
}: {
  config: RasterizeConfig;
  onSave: (config: RasterizeConfig) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pages, setPages] = useState(config.pages);
  const [dpi, setDpi] = useState(String(config.dpi));

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const edited: RasterizeConfig = { pages: pages.trim(), dpi: Number(dpi) };
  const problem = dpi.trim() === "" ? "Enter a resolution." : configError(edited);
  const unchanged = edited.pages === config.pages && edited.dpi === config.dpi;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (problem !== null || unchanged) return;
    onSave(edited);
    dialog.current?.close();
  }

  return (
    <dialog
      ref={dialog}
      className="app-dialog"
      aria-labelledby="config-title"
      onClose={onCancel}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <form onSubmit={save}>
        <div className="dialog-head">
          <h2 id="config-title">Rasterize: config</h2>
          <button type="button" className="dialog-close" aria-label="Cancel" onClick={() => dialog.current?.close()}>
            <CloseIcon />
          </button>
        </div>
        <label className="field">
          Pages
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="All pages"
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            aria-describedby="config-pages-hint"
          />
        </label>
        <p id="config-pages-hint" className="field-hint">
          The PDF's own page numbers, counted from 1, not the numbers printed on the pages. For example "1, 41-47":
          the cover, for the metadata, and one piece.
        </p>
        <label className="field">
          Resolution for vector pages (dpi)
          <input
            type="number"
            inputMode="numeric"
            min={MIN_DPI}
            max={MAX_DPI}
            step={1}
            value={dpi}
            onChange={(e) => setDpi(e.target.value)}
            aria-describedby="config-dpi-hint"
          />
        </label>
        <p id="config-dpi-hint" className="field-hint">
          Scanned pages keep their own resolution.
        </p>
        <p className="field-message" role="alert">
          {problem}
        </p>
        <div className="dialog-buttons">
          <button type="button" className="button-secondary" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="button-primary" disabled={problem !== null || unchanged}>
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
