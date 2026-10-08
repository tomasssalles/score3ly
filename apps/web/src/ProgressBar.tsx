// A thin progress bar. `value` is a fraction from 0 to 1. No numbers are shown.
export function ProgressBar({ value, label }: { value: number; label: string }) {
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
