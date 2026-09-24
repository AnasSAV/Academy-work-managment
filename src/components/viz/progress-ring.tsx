import { toPercent } from "@/lib/progress";

interface ProgressRingProps {
  /** 0 to 1. */
  value: number;
  /** What the ring measures, for the accessible name. */
  label: string;
  size?: number;
}

/**
 * A ratio drawn as a ring: the meter form for one number. The track is a lighter step of the
 * same colour, the data end is rounded, and the number sits in the middle as the hero figure.
 */
export function ProgressRing({ value, label, size = 176 }: ProgressRingProps) {
  const percent = toPercent(value);
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (percent / 100) * circumference;

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          style={{ stroke: "color-mix(in oklab, var(--viz-series-1) 16%, var(--card))" }}
        />
        {percent > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap={percent >= 100 ? "butt" : "round"}
            strokeDasharray={`${filled} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ stroke: "var(--viz-series-1)" }}
          />
        )}
      </svg>
      <p className="absolute inset-0 flex items-center justify-center text-5xl font-semibold">
        {percent}
        <span className="text-muted-foreground ml-0.5 text-2xl font-medium">%</span>
      </p>
    </div>
  );
}
