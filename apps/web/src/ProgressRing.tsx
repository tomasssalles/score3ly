// A small progress circle. `value` is a fraction from 0 to 1, or null when there is nothing to show.
export function ProgressRing({ value, label, size = 28 }: { value: number | null; label: string; size?: number }) {
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const fraction = value === null ? 0 : Math.min(1, Math.max(0, value));
  return (
    <svg
      className="progress-ring"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(fraction * 100)}
    >
      <circle className="track" cx="12" cy="12" r={radius} />
      {fraction > 0 && (
        <circle
          className="bar"
          cx="12"
          cy="12"
          r={radius}
          strokeDasharray={`${fraction * circumference} ${circumference}`}
          transform="rotate(-90 12 12)"
        />
      )}
    </svg>
  );
}
