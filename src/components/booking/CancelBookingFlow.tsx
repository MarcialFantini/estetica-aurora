/** @jsxImportSource preact */
import { useEffect, useState } from "preact/hooks";
import type { JSX } from "preact";
import {
  buscarReservaPorCodigo,
  cancelarReservaConMotivo,
  eliminarReservaPorCodigo,
} from "../../lib/reservas";
import type { Reserva } from "../../lib/types";
import { profesionalPorId, servicioPorId } from "../../data/servicios";
import { addMinutes, formatFechaLarga, formatHora } from "../../lib/horarios";

interface Props {
  codigo: string;
}

type State =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "found"; reserva: Reserva }
  | { status: "cancelled"; codigo: string };

const MOTIVOS: { id: string; label: string }[] = [
  { id: "no-puedo-ir", label: "No puedo ir" },
  { id: "enfermedad", label: "Enfermedad / malestar" },
  { id: "reagendar", label: "Quiero reagendar" },
  { id: "emergencia", label: "Emergencia familiar" },
  { id: "clima", label: "Problema de transporte / clima" },
  { id: "otro", label: "Otro motivo" },
];

const NOTA_MAX = 280;

export default function CancelBookingFlow({ codigo }: Props): JSX.Element {
  const [state, setState] = useState<State>({ status: "loading" });
  const [motivo, setMotivo] = useState<string>("");
  const [nota, setNota] = useState<string>("");
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
    const found = buscarReservaPorCodigo(codigo);
    setState(found ? { status: "found", reserva: found } : { status: "missing" });
  }, [codigo]);

  if (!hydrated || state.status === "loading") return <Skeleton />;
  if (state.status === "missing") return <Missing codigo={codigo} />;
  if (state.status === "cancelled") return <Cancelled codigo={state.codigo} />;

  const reserva = state.reserva;

  const serviciosNombres = (reserva.servicioIds ?? [])
    .map((id) => servicioPorId(id)?.nombre)
    .filter(Boolean);

  const profesional = profesionalPorId(reserva.profesionalId);
  const profesionalLabel =
    reserva.profesionalId === "cualquiera"
      ? "Cualquiera disponible"
      : profesional?.nombre ?? "Profesional Aurora";

  const handleConfirm = () => {
    if (!motivo) {
      setError("Elegí un motivo antes de confirmar.");
      return;
    }
    setError(null);
    cancelarReservaConMotivo(codigo, motivo, nota);
    setState({ status: "cancelled", codigo });
  };

  const handleHardDelete = () => {
    if (
      !confirm(
        "¿Eliminar definitivamente la reserva del historial? Esta acción no se puede deshacer.",
      )
    )
      return;
    eliminarReservaPorCodigo(codigo);
    setState({ status: "cancelled", codigo });
  };

  return (
    <div>
      <div class="bezel-shell">
        <div
          class="bezel-core overflow-hidden p-6 sm:p-10"
          style="background: var(--color-paper-2);"
        >
          <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
            Cancelar reserva
          </p>
          <h1 class="display-italic mt-3 font-serif text-[clamp(1.9rem,4.5vw,2.8rem)] leading-[1.05] text-[var(--color-ink)]">
            ¿Querés <em>cancelar</em> este turno?
          </h1>
          <p class="mt-4 max-w-[44ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
            Liberamos tu horario para que otra clienta pueda usarlo. La cancelación
            queda registrada con tu motivo.
          </p>

          <div
            class="mt-8 rounded-[var(--radius-input)] border border-[rgba(31,24,18,0.08)] p-5"
            style="background: var(--color-paper-3);"
          >
            <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
              Tu reserva
            </p>
            <dl class="mt-3 grid gap-2 text-[14.5px]">
              <div class="flex justify-between gap-3">
                <dt class="text-[var(--color-ink-2)]">Servicios</dt>
                <dd class="text-right font-medium text-[var(--color-ink)]">
                  {serviciosNombres.join(" + ")}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-[var(--color-ink-2)]">Profesional</dt>
                <dd class="text-right">{profesionalLabel}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-[var(--color-ink-2)]">Fecha</dt>
                <dd class="text-right">{formatFechaLarga(reserva.fecha)}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-[var(--color-ink-2)]">Hora</dt>
                <dd class="text-right font-mono tabular-nums">
                  {formatHora(reserva.hora)} -{" "}
                  {formatHora(addMinutes(reserva.hora, reserva.duracionTotalMin || reserva.duracionMin))}
                </dd>
              </div>
              <div class="flex justify-between gap-3 border-t border-[rgba(31,24,18,0.08)] pt-2 mt-1">
                <dt class="text-[var(--color-ink-2)]">Código</dt>
                <dd class="text-right font-mono tabular-nums text-[var(--color-clay)]">
                  {reserva.codigo}
                </dd>
              </div>
            </dl>
          </div>

          <form
            class="mt-8 grid gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (!motivo) {
                setError("Elegí un motivo antes de continuar.");
                return;
              }
              setError(null);
              setShowConfirm(true);
            }}
          >
            <fieldset>
              <legend class="block text-[13px] font-medium text-[var(--color-ink)]">
                ¿Por qué cancelás?{" "}
                <span class="text-[var(--color-muted)] font-normal">
                  (lo usamos para mejorar)
                </span>
              </legend>
              <div class="mt-3 grid gap-2 sm:grid-cols-2">
                {MOTIVOS.map((m) => {
                  const active = motivo === m.id;
                  return (
                    <label
                      key={m.id}
                      class="flex cursor-pointer items-center gap-3 rounded-[var(--radius-input)] border p-3 text-[14px] transition-colors"
                      style={{
                        background: active
                          ? "var(--color-paper-3)"
                          : "transparent",
                        borderColor: active
                          ? "var(--color-clay)"
                          : "rgba(31,24,18,0.12)",
                      }}
                    >
                      <input
                        type="radio"
                        name="motivo"
                        value={m.id}
                        class="h-4 w-4 accent-[var(--color-clay)]"
                        checked={active}
                        onChange={() => {
                          setMotivo(m.id);
                          setError(null);
                        }}
                      />
                      <span class="text-[var(--color-ink)]">{m.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label
                class="flex items-baseline justify-between text-[13px] font-medium text-[var(--color-ink)]"
                for="cancel-nota"
              >
                <span>
                  Nota{" "}
                  <span class="text-[var(--color-muted)] font-normal">(opcional)</span>
                </span>
                <span
                  class="font-mono tabular-nums text-[11px]"
                  style={{
                    color:
                      nota.length > NOTA_MAX
                        ? "var(--color-clay)"
                        : "var(--color-muted)",
                  }}
                >
                  {nota.length}/{NOTA_MAX}
                </span>
              </label>
              <textarea
                id="cancel-nota"
                rows={3}
                maxLength={NOTA_MAX + 30}
                class="field mt-1.5 resize-none"
                placeholder="Si querés dejarnos un detalle para mejorar, escribilo acá."
                value={nota}
                onInput={(e) =>
                  setNota((e.currentTarget as HTMLTextAreaElement).value)
                }
              />
            </div>

            {error && (
              <p class="text-[13px] text-[var(--color-clay)]" role="alert">
                {error}
              </p>
            )}

            <div class="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(31,24,18,0.08)] pt-6">
              <a href={`/reservar/${codigo}`} class="btn-pill btn-ghost">
                <span>Volver al comprobante</span>
              </a>
              <button
                type="submit"
                class="btn-pill"
                style="background: transparent; color: var(--color-clay); border: 1px solid rgba(122,61,46,0.32);"
              >
                <span>Cancelar reserva</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {showConfirm && (
        <ConfirmModal
          reserva={reserva}
          motivo={MOTIVOS.find((m) => m.id === motivo)?.label ?? motivo}
          nota={nota}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
          onHardDelete={handleHardDelete}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  reserva,
  motivo,
  nota,
  onConfirm,
  onCancel,
  onHardDelete,
}: {
  reserva: Reserva;
  motivo: string;
  nota: string;
  onConfirm: () => void;
  onCancel: () => void;
  onHardDelete: () => void;
}): JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      class="fixed inset-0 z-50 flex items-center justify-center px-4"
      style="background: rgba(31, 24, 18, 0.45); backdrop-filter: blur(4px);"
    >
      <div
        class="bezel-shell w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          class="bezel-core p-6"
          style="background: var(--color-paper-2);"
        >
          <p
            id="confirm-title"
            class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-clay)]"
          >
            Confirmar cancelación
          </p>
          <h2 class="mt-2 font-serif text-[20px] leading-[1.15] text-[var(--color-ink)]">
            ¿Cancelar la reserva del{" "}
            {formatFechaLarga(reserva.fecha)} a las{" "}
            <span class="font-mono tabular-nums">{formatHora(reserva.hora)}</span>?
          </h2>
          <p class="mt-3 text-[13px] text-[var(--color-ink-2)]">
            El horario vuelve a estar disponible y el código{" "}
            <span class="font-mono tabular-nums">{reserva.codigo}</span> queda
            liberado.
          </p>
          <div
            class="mt-4 rounded-[var(--radius-input)] border border-[rgba(31,24,18,0.08)] p-3 text-[13px]"
            style="background: var(--color-paper-3);"
          >
            <p>
              <span class="text-[var(--color-muted)]">Motivo:</span>{" "}
              <span class="text-[var(--color-ink)]">{motivo}</span>
            </p>
            {nota && (
              <p class="mt-1">
                <span class="text-[var(--color-muted)]">Nota:</span>{" "}
                <span class="text-[var(--color-ink)]">"{nota}"</span>
              </p>
            )}
          </div>
          <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              class="btn-pill btn-ghost !py-2 !px-3 text-[12px]"
              onClick={onHardDelete}
              title="Quitar del historial (no se puede deshacer)"
            >
              Eliminar del historial
            </button>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="btn-pill btn-ghost"
                onClick={onCancel}
              >
                <span>Volver</span>
              </button>
              <button
                type="button"
                class="btn-pill btn-primary"
                onClick={onConfirm}
              >
                <span>Sí, cancelar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Skeleton(): JSX.Element {
  return (
    <div class="bezel-shell">
      <div class="bezel-core p-6 sm:p-10" aria-busy="true" aria-live="polite">
        <div class="h-6 w-32 rounded-full bg-[rgba(31,24,18,0.06)]" />
        <div class="mt-6 h-12 w-3/4 rounded-2xl bg-[rgba(31,24,18,0.06)]" />
      </div>
    </div>
  );
}

function Missing({ codigo }: { codigo: string }): JSX.Element {
  return (
    <div class="bezel-shell">
      <div class="bezel-core p-6 sm:p-10">
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Sin resultados
        </p>
        <h1 class="display-italic mt-3 font-serif text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.05] text-[var(--color-ink)]">
          No encontramos la reserva <em>{codigo}</em>.
        </h1>
        <p class="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          Es posible que ya se haya cancelado. Si querés, sacá un turno nuevo.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <a href="/reservar" class="btn-pill btn-primary">
            <span>Hacer una reserva nueva</span>
          </a>
          <a href="/" class="btn-pill btn-ghost">
            <span>Volver al inicio</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function Cancelled({ codigo }: { codigo: string }): JSX.Element {
  return (
    <div class="bezel-shell">
      <div
        class="bezel-core overflow-hidden p-6 sm:p-10"
        style="background: var(--color-paper-2);"
      >
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Reserva cancelada
        </p>
        <h1 class="display-italic mt-3 font-serif text-[clamp(1.9rem,4.5vw,2.8rem)] leading-[1.05] text-[var(--color-ink)]">
          Tu reserva <em>fue cancelada</em>.
        </h1>
        <p class="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          Si fue un error o cambiás de opinión, podés sacar un turno nuevo cuando
          quieras. La agenda vuelve a estar abierta.
        </p>
        <p class="mt-3 font-mono text-[12px] tabular-nums text-[var(--color-muted)]">
          Código liberado: {codigo}
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <a href="/reservar" class="btn-pill btn-primary">
            <span>Hacer una reserva nueva</span>
            <span class="icon-bubble !h-5 !w-5" aria-hidden="true">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
          </a>
          <a href="/" class="btn-pill btn-ghost">
            <span>Volver al inicio</span>
          </a>
        </div>
      </div>
    </div>
  );
}