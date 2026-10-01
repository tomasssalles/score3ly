// Side-by-side viewer for the test set (DESIGN.md §13).
// Stub: three empty panes, no PDFs loaded yet.

const paneStyle = { flex: 1, border: "1px solid #ccc", padding: 8 };

export function Viewer() {
  return (
    <div style={{ display: "flex", gap: 8, height: "100vh", boxSizing: "border-box", padding: 8 }}>
      <div style={paneStyle}>Original</div>
      <div style={paneStyle}>Engraving A</div>
      <div style={paneStyle}>Engraving B</div>
    </div>
  );
}
