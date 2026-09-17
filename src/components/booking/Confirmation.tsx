/** @jsxImportSource preact */
import { useEffect, useState } from "preact/hooks";
import type { JSX } from "preact";
import type { Reserva } from "../../lib/types";
import { profesionalPorId, servicioPorId } from "../../data/servicios";
import {
  addMinutes,
  formatFechaLarga,
  formatHora,
  formatPrecio,
  fromIsoDate,
} from "../../lib/horarios";
import { cargarReservas, eliminarReservaPorCodigo } from "../../lib/reservas";
import {
  cargarEstados,
  desmarcarCompletada,
  marcarCompletada,
} from "../../lib/estadoReservas";
import { type Rating, ratingPorReserva } from "../../lib/ratings";
import { RatingStarsDisplay } from "./RatingStars";
import RatingSection from "./RatingSection";
import RescheduleFlow from "./RescheduleFlow";

interface Props {
  codigo: string;
}

type State =
  | { status: "loading" }
  | { status: "found"; reserva: Reserva; completada: boolean; rating?: Rating }
  | { status: "missing" };

type Mode = "view" | "reschedule" | "confirm-cancel" | "cancelled";

const RESCHEDULE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

/** Returns milliseconds until the appointment, or null if the time has
 *  already passed. */
const msHastaTurno = (reserva: Reserva): number => {
  const [hh, mm] = reserva.hora.split(":").map(Number);
  const fecha = fromIsoDate(reserva.fecha);
  fecha.setHours(hh ?? 0, mm ?? 0, 0, 0);
  return fecha.getTime() - Date.now();
};

export default function Confirmation({ codigo }: Props): JSX.Element {
  const [state, setState] = useState<State>({ status: "loading" });
  const [mode, setMode] = useState<Mode>("view");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const reservas = cargarReservas();
    const found = reservas.find((r) => r.codigo === codigo);
    if (!found) {
      setState({ status: "missing" });
      return;
    }
    const estados = cargarEstados();
    const completada = estados[codigo] === "completada";
    const rating = ratingPorReserva(codigo);
    setState({ status: "found", reserva: found, completada, rating });
  }, [codigo, refreshTick]);

  if (state.status === "loading") {
    return <Skeleton />;
  }

  if (state.status === "missing") {
    return <Missing codigo={codigo} />;
  }

  if (mode === "cancelled") {
    return <Cancelled codigo={codigo} />;
  }

  return (
    <Receipt
      reserva={state.reserva}
      completada={state.completada}
      existingRating={state.rating}
      mode={mode}
      onModeChange={setMode}
      onRefresh={() => setRefreshTick((n) => n + 1)}
    />
  );
}

function Skeleton(): JSX.Element {
  return (
    <div class="bezel-shell">
      <div class="bezel-core p-6 sm:p-10" aria-busy="true" aria-live="polite">
        <div class="h-6 w-32 rounded-full bg-[rgba(31,24,18,0.06)]" />
        <div class="mt-6 h-12 w-3/4 rounded-2xl bg-[rgba(31,24,18,0.06)]" />
        <div class="mt-8 grid gap-4 sm:grid-cols-2">
          <div class="h-20 rounded-[var(--radius-input)] bg-[rgba(31,24,18,0.05)]" />
          <div class="h-20 rounded-[var(--radius-input)] bg-[rgba(31,24,18,0.05)]" />
        </div>
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
          Es posible que la reserva se haya cancelado, que se haya hecho desde otro
          navegador, o que el almacenamiento local esté desactivado.
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

interface ReceiptProps {
  reserva: Reserva;
  completada: boolean;
  existingRating?: Rating;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  onRefresh: () => void;
}

function Receipt({
  reserva,
  completada: initialCompletada,
  existingRating,
  mode,
  onModeChange,
  onRefresh,
}: ReceiptProps): JSX.Element {
  const servicio = servicioPorId(reserva.servicioId);
  const profesional = profesionalPorId(reserva.profesionalId);
  const profesionalLabel =
    reserva.profesionalId === "cualquiera"
      ? "Cualquiera disponible"
      : profesional?.nombre ?? reserva.profesionalId;

  const [completada, setCompletada] = useState<boolean>(initialCompletada);
  // Sync local completion state with the upstream prop (it changes after
  // refreshTick bumps when we mutate the storage).
  useEffect(() => {
    setCompletada(initialCompletada);
  }, [initialCompletada]);

  const ms = msHastaTurno(reserva);
  const turnoEnPasado = ms <= 0;
  const turnoCercano = ms > 0 && ms < RESCHEDULE_THRESHOLD_MS;
  // Reagendar is allowed only when the appointment is comfortably in the
  // future (>2h ahead). Past or imminent turns can't be moved.
  const puedeReagendar = !turnoEnPasado && !turnoCercano;

  const handleMarcarCompletada = () => {
    marcarCompletada(reserva.codigo);
    setCompletada(true);
  };
  const handleDesmarcarCompletada = () => {
    desmarcarCompletada(reserva.codigo);
    setCompletada(false);
  };

  const handleCancelar = () => {
    eliminarReservaPorCodigo(reserva.codigo);
    onModeChange("cancelled");
  };

  const handleRescheduleConfirm = (_updated: Reserva) => {
    onModeChange("view");
    // Notify parent so it re-reads localStorage.
    onRefresh();
  };

  return (
    <div class="bezel-shell">
      <div
        class="bezel-core overflow-hidden p-6 sm:p-10"
        style="background: var(--color-paper-2);"
      >
        <div class="flex flex-wrap items-center gap-3">
          <span
            class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium"
            style={
              completada
                ? "background: rgba(122,130,102,0.18); color: #4d5534;"
                : "background: rgba(122,61,46,0.12); color: var(--color-clay);"
            }
          >
            <span
              aria-hidden="true"
              class="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: completada ? "#4d5534" : "var(--color-clay)",
              }}
            />
            {completada ? "Completada" : "Reserva confirmada"}
          </span>
          <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-muted)]">
            Comprobante
          </p>
        </div>

        <h1 class="display-italic mt-5 font-serif text-[clamp(1.9rem,4.5vw,2.8rem)] leading-[1.05] text-[var(--color-ink)]">
          {completada ? (
            <>
              Gracias, <em>nos vemos pronto</em>.
            </>
          ) : (
            <>
              Listo, <em>te esperamos</em>.
            </>
          )}
        </h1>
        <p class="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          {completada
            ? "Tu reseña nos ayuda a mejorar. Si querés, dejános tu calificación."
            : "Guardá tu código. Si necesitás reprogramar, usá los botones de abajo."}
        </p>

        <div
          class="mt-8 inline-flex flex-col rounded-[var(--radius-card)] border border-dashed px-6 py-5"
          style="border-color: rgba(122,61,46,0.4); background: var(--color-paper-3);"
        >
          <span class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
            Tu código
          </span>
          <span
            class="mt-2 font-mono text-[28px] font-medium tabular-nums tracking-[0.06em] text-[var(--color-clay)] sm:text-[34px]"
            aria-label={`Código de reserva ${reserva.codigo}`}
          >
            {reserva.codigo}
          </span>
        </div>

        <dl class="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-[rgba(31,24,18,0.08)] bg-[rgba(31,24,18,0.08)] sm:grid-cols-2">
          <Detail label="Servicio" value={servicio?.nombre ?? reserva.servicioId} />
          <Detail label="Profesional" value={profesionalLabel} />
          <Detail
            label="Fecha"
            value={formatFechaLarga(reserva.fecha)}
          />
          <Detail
            label="Hora"
            value={`${formatHora(reserva.hora)} - ${formatHora(
              addMinutes(reserva.hora, reserva.duracionMin),
            )}`}
          />
          <Detail
            label="Duración"
            value={`${reserva.duracionMin} minutos`}
          />
          <Detail
            label="Cliente"
            value={reserva.cliente.nombre}
          />
          <Detail
            label="Contacto"
            value={
              <span class="block">
                {reserva.cliente.telefono}
                <br />
                <span class="text-[var(--color-ink-2)]">{reserva.cliente.email}</span>
              </span>
            }
          />
          {servicio && (
            <Detail
              label="Precio"
              value={formatPrecio(servicio.precio)}
              className="sm:col-span-2"
            />
          )}
          {reserva.cliente.notas && (
            <Detail
              label="Notas"
              value={reserva.cliente.notas}
              className="sm:col-span-2"
            />
          )}
        </dl>

        {/* ── Actions: reschedule / cancel ───────────────────────────── */}
        {!completada && mode === "view" && (
          <div class="mt-10">
            <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
              Cambios
            </p>
            <div class="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                class="btn-pill btn-ghost"
                onClick={() => onModeChange("reschedule")}
                disabled={!puedeReagendar}
                title={
                  puedeReagendar
                    ? undefined
                    : "Faltan menos de 2 horas para tu turno. No se puede reagendar."
                }
                style={!puedeReagendar ? { opacity: 0.5 } : undefined}
              >
                <span>Reagendar</span>
              </button>
              <button
                type="button"
                class="btn-pill"
                onClick={() => onModeChange("confirm-cancel")}
                style="background: transparent; color: var(--color-clay); border: 1px solid rgba(122,61,46,0.32);"
              >
                <span>Cancelar reserva</span>
              </button>
            </div>
            {!puedeReagendar && (
              <p class="mt-3 text-[12px] text-[var(--color-muted)]">
                {turnoEnPasado
                  ? "Tu turno ya pasó. Si querés cambiar la hora, hacé una reserva nueva."
                  : "Faltan menos de 2 horas para tu turno. No se puede reagendar."}
              </p>
            )}
          </div>
        )}

        {mode === "reschedule" && servicio && (
          <div class="mt-8">
            <RescheduleFlow
              reserva={reserva}
              servicio={servicio}
              onConfirm={handleRescheduleConfirm}
              onCancel={() => onModeChange("view")}
            />
          </div>
        )}

        {mode === "confirm-cancel" && (
          <div class="mt-8 rounded-[var(--radius-input)] border border-[rgba(122,61,46,0.32)] bg-[rgba(122,61,46,0.06)] p-5">
            <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-clay)]">
              Confirmar cancelación
            </p>
            <p class="mt-2 font-serif text-[18px] leading-[1.2] text-[var(--color-ink)]">
              ¿Cancelar la reserva del {formatFechaLarga(reserva.fecha)} a las{" "}
              <span class="font-mono tabular-nums">{formatHora(reserva.hora)}</span>?
            </p>
            <p class="mt-2 text-[13px] text-[var(--color-ink-2)]">
              Esta acción no se puede deshacer. El código {reserva.codigo} queda
              liberado y el horario vuelve a estar disponible.
            </p>
            <div class="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                class="btn-pill btn-primary"
                onClick={handleCancelar}
              >
                <span>Sí, cancelar</span>
              </button>
              <button
                type="button"
                class="btn-pill btn-ghost"
                onClick={() => onModeChange("view")}
              >
                <span>Volver</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Completion / rating ────────────────────────────────────── */}
        <div class="mt-10">
          {!completada && turnoEnPasado && (
            <div class="rounded-[var(--radius-input)] border border-[rgba(31,24,18,0.08)] bg-[var(--color-paper-3)] p-5">
              <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
                ¿Cómo te fue?
              </p>
              <p class="mt-2 font-serif text-[18px] leading-[1.2] text-[var(--color-ink)]">
                Marcá el turno como completado y dejános tu reseña.
              </p>
              <div class="mt-4">
                <button
                  type="button"
                  class="btn-pill btn-primary"
                  onClick={handleMarcarCompletada}
                >
                  <span>Marcar como completada</span>
                </button>
              </div>
            </div>
          )}

          {completada && (
            <div>
              <div class="mb-4 flex items-baseline justify-between gap-3">
                <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
                  Reseña
                </p>
                <button
                  type="button"
                  class="text-[12px] text-[var(--color-muted)] underline-offset-2 hover:underline"
                  onClick={handleDesmarcarCompletada}
                  title="Volver a marcar como pendiente"
                >
                  Deshacer completado
                </button>
              </div>
              {servicio && profesional && (
                <RatingSection
                  reservaId={reserva.codigo}
                  estilistaId={profesional.id}
                  estilistaNombre={profesional.nombre}
                  initialExisting={existingRating}
                  onChange={onRefresh}
                />
              )}
              {profesional && existingRating && (
                <div class="mt-3 text-[12px] text-[var(--color-muted)]">
                  Esta reseña alimenta el promedio de{" "}
                  <span class="text-[var(--color-ink)]">{profesional.nombre}</span>{" "}
                  que se muestra en el selector del flujo de reserva.
                  <span class="ml-2 inline-flex items-center gap-1">
                    <RatingStarsDisplay
                      promedio={existingRating.rating}
                      count={1}
                      size="sm"
                    />
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div class="mt-10 flex flex-wrap gap-3 border-t border-[rgba(31,24,18,0.08)] pt-8">
          <a href="/" class="btn-pill btn-primary">
            <span>Volver al inicio</span>
          </a>
          <a href="/reservar" class="btn-pill btn-ghost">
            <span>Hacer otra reserva</span>
          </a>
        </div>

        <p class="mt-8 text-[12px] text-[var(--color-muted)]">
          Esta reserva está guardada en tu navegador. Si lo limpiás, se pierde.
        </p>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string | JSX.Element;
  className?: string;
}): JSX.Element {
  return (
    <div class={`p-5 ${className}`} style="background: var(--color-paper-2);">
      <dt class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
        {label}
      </dt>
      <dd class="mt-1.5 text-[15px] leading-relaxed text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}
