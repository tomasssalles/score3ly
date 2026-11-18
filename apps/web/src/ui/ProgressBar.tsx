// A thin progress bar. `value` is a fraction from 0 to 1, or null where the progress isn't known here (a stage running
// on another device): then a short grey strip slides through the bar from left to right, again and again, like the
// collapsed strip's grey spinner (docs/style.md, "Progress"). No numbers are shown.
export function ProgressBar({ value, label }: { value: number | null; label: string }) {
  if (value === null)
    return (
      <div className="progress-bar indeterminate" role="progressbar" aria-label={label}>
        <div className="progress-bar-slider" />
      </div>
    );
  const fraction = Math.min(1, Math.max(0, value));
  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
    >
      <div className="progress-bar-fill" style={{ width: `${fraction * 100}%` }} />
    </div>
  );
}
