/** @jsxImportSource preact */
import type { JSX } from "preact";
import { useState } from "preact/hooks";

interface RatingStarsDisplayProps {
  promedio: number;
  count: number;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { star: 12, gap: "gap-0.5", text: "text-[11px]" },
  md: { star: 14, gap: "gap-1", text: "text-[12px]" },
  lg: { star: 18, gap: "gap-1.5", text: "text-[13px]" },
} as const;

/**
 * Read-only rating — a row of 5 stars filled proportionally + count.
 * "promedio" is shown as a fixed 5-star display: any value < full star
 * rounds to half-step rendering. We use 5 discrete icons with empty/full.
 */
export function RatingStarsDisplay({
  promedio,
  count,
  size = "md",
}: RatingStarsDisplayProps): JSX.Element {
  const cfg = SIZES[size];
  const filled = Math.round(promedio);

  return (
    <span
      class={`inline-flex items-center ${cfg.gap} font-mono tabular-nums ${cfg.text}`}
      style="color: var(--color-clay);"
      aria-label={
        count === 0
          ? "Sin calificaciones"
          : `Promedio ${promedio.toFixed(1)} de 5, ${count} reseña${count === 1 ? "" : "s"}`
      }
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={cfg.star} filled={i <= filled} />
      ))}
      {count > 0 ? (
        <span class="ml-1.5 text-[var(--color-ink-2)]">
          {promedio.toFixed(1)}
          <span class="mx-1 text-[var(--color-muted)]">·</span>
          {count} {count === 1 ? "reseña" : "reseñas"}
        </span>
      ) : (
        <span class="ml-1.5 text-[var(--color-muted)]">Sin reseñas</span>
      )}
    </span>
  );
}

function Star({ size, filled }: { size: number; filled: boolean }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      stroke-width="1.25"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M7 1.2l1.85 3.75 4.15.6-3 2.92.71 4.13L7 10.6l-3.71 1.95.71-4.13-3-2.92 4.15-.6L7 1.2z" />
    </svg>
  );
}

interface RatingStarsInputProps {
  value: 0 | 1 | 2 | 3 | 4 | 5;
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void;
  label?: string;
}

/** Interactive 5-star input — large tap targets, keyboard accessible. */
export function RatingStarsInput({
  value,
  onChange,
  label = "Tu calificación",
}: RatingStarsInputProps): JSX.Element {
  const [hover, setHover] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const shown = (hover || value) as 0 | 1 | 2 | 3 | 4 | 5;

  return (
    <div>
      <span class="block text-[13px] font-medium text-[var(--color-ink)]">{label}</span>
      <div
        class="mt-2 inline-flex items-center gap-1"
        role="radiogroup"
        aria-label={label}
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((i) => {
          const isOn = i <= shown;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={value === i}
              aria-label={`${i} ${i === 1 ? "estrella" : "estrellas"}`}
              class="inline-flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-300 hover:scale-110"
              onMouseEnter={() => setHover(i as 0 | 1 | 2 | 3 | 4 | 5)}
              onFocus={() => setHover(i as 0 | 1 | 2 | 3 | 4 | 5)}
              onBlur={() => setHover(0)}
              onClick={() => onChange(i as 1 | 2 | 3 | 4 | 5)}
              style={{
                color: isOn ? "var(--color-clay)" : "var(--color-muted)",
              }}
            >
              <Star size={20} filled={isOn} />
            </button>
          );
        })}
        {value > 0 && (
          <span class="ml-2 font-mono text-[13px] tabular-nums text-[var(--color-ink-2)]">
            {value}.0
          </span>
        )}
      </div>
    </div>
  );
}
