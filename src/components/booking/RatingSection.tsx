/** @jsxImportSource preact */
import { useEffect, useState } from "preact/hooks";
import type { JSX } from "preact";
import {
  type Rating,
  eliminarRating,
  guardarRating,
  ratingPorReserva,
} from "../../lib/ratings";
import { RatingStarsDisplay, RatingStarsInput } from "./RatingStars";

interface RatingSectionProps {
  reservaId: string;
  estilistaId: string;
  estilistaNombre: string;
  /** When true, render in collapsed "editable" mode (existing rating can
   *  be edited). When false, render the empty form. */
  initialExisting?: Rating | undefined;
  onChange?: () => void;
}

/**
 * Rating form + display for the receipt page. Two states:
 * - No rating yet → form with stars + optional comment.
 * - Existing rating → display with an "Editar" toggle.
 */
export default function RatingSection({
  reservaId,
  estilistaId,
  estilistaNombre,
  initialExisting,
  onChange,
}: RatingSectionProps): JSX.Element {
  const [rating, setRating] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [comentario, setComentario] = useState<string>("");
  const [saved, setSaved] = useState<Rating | undefined>(initialExisting);
  const [editing, setEditing] = useState<boolean>(!initialExisting);
  const [submitted, setSubmitted] = useState<boolean>(false);

  useEffect(() => {
    if (!initialExisting) {
      const existing = ratingPorReserva(reservaId);
      if (existing) {
        setSaved(existing);
        setRating(existing.rating);
        setComentario(existing.comentario ?? "");
        setEditing(false);
      }
    }
  }, [reservaId, initialExisting]);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (rating === 0) return;
    const r: Rating = {
      estilistaId,
      reservaId,
      rating: rating as 1 | 2 | 3 | 4 | 5,
      comentario: comentario.trim() || undefined,
      fecha: new Date().toISOString(),
    };
    guardarRating(r);
    setSaved(r);
    setEditing(false);
    setSubmitted(true);
    onChange?.();
  };

  const handleEliminar = () => {
    eliminarRating(reservaId);
    setSaved(undefined);
    setRating(0);
    setComentario("");
    setEditing(true);
    setSubmitted(false);
    onChange?.();
  };

  const handleEditar = () => {
    setEditing(true);
    setSubmitted(false);
  };

  if (saved && !editing) {
    return (
      <div class="rounded-[var(--radius-input)] border border-[rgba(31,24,18,0.08)] bg-[var(--color-paper-3)] p-5">
        <div class="flex items-baseline justify-between gap-3">
          <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
            Tu reseña
          </p>
          <button
            type="button"
            class="text-[12px] font-medium text-[var(--color-clay)] underline-offset-2 hover:underline"
            onClick={handleEditar}
          >
            Editar
          </button>
        </div>
        <div class="mt-2">
          <RatingStarsDisplay promedio={saved.rating} count={1} size="md" />
        </div>
        {saved.comentario && (
          <p class="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
            “{saved.comentario}”
          </p>
        )}
        <p class="mt-3 text-[12px] text-[var(--color-muted)]">
          Sobre <span class="text-[var(--color-ink)]">{estilistaNombre}</span>
        </p>
      </div>
    );
  }

  return (
    <form
      class="rounded-[var(--radius-input)] border border-[rgba(31,24,18,0.08)] bg-[var(--color-paper-3)] p-5"
      onSubmit={handleSubmit}
    >
      <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
        {submitted ? "Gracias" : "Calificá tu experiencia"}
      </p>
      <p class="mt-2 font-serif text-[18px] leading-[1.2] text-[var(--color-ink)]">
        {submitted ? "Reseña registrada." : `¿Cómo te atendió ${estilistaNombre.split(" ")[0]}?`}
      </p>

      {!submitted && (
        <>
          <div class="mt-4">
            <RatingStarsInput
              value={rating}
              onChange={(v) => setRating(v)}
            />
          </div>

          <div class="mt-4">
            <label
              class="block text-[13px] font-medium text-[var(--color-ink)]"
              for={`comentario-${reservaId}`}
            >
              Comentario <span class="text-[var(--color-muted)]">(opcional)</span>
            </label>
            <textarea
              id={`comentario-${reservaId}`}
              rows={3}
              maxLength={400}
              class="field mt-1.5 resize-none"
              placeholder="Contanos cómo fue tu experiencia."
              value={comentario}
              onInput={(e) => setComentario((e.currentTarget as HTMLTextAreaElement).value)}
            />
          </div>

          <div class="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              class="btn-pill btn-primary"
              disabled={rating === 0}
              style={{ opacity: rating === 0 ? 0.5 : 1 }}
            >
              <span>{saved ? "Actualizar reseña" : "Enviar reseña"}</span>
            </button>
            {saved && (
              <button
                type="button"
                class="btn-pill btn-ghost"
                onClick={handleEliminar}
              >
                <span>Eliminar</span>
              </button>
            )}
          </div>
        </>
      )}

      {submitted && (
        <div class="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            class="btn-pill btn-ghost"
            onClick={handleEditar}
          >
            <span>Cambiar mi reseña</span>
          </button>
        </div>
      )}
    </form>
  );
}
