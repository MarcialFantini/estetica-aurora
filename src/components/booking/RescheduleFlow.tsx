/** @jsxImportSource preact */
import { useEffect, useMemo, useState } from "preact/hooks";
import type { JSX } from "preact";
import {
  cargarReservas,
  guardarReservas,
  slotsOcupados,
  validarSlotLibre,
} from "../../lib/reservas";
import type { Reserva, Servicio } from "../../lib/types";
import { profesionales, profesionalPorId } from "../../data/servicios";
import {
  MESES,
  addMinutes,
  cmpHHMM,
  formatFechaLarga,
  formatHora,
  fromIsoDate,
  generarSlots,
  isoWeekday,
  toIsoDate,
} from "../../lib/horarios";

interface RescheduleFlowProps {
  reserva: Reserva;
  servicio: Servicio;
  onConfirm: (updated: Reserva) => void;
  onCancel: () => void;
}

const HORARIO_FIN_INCLUSIVE = 19;
const HORARIO_INICIO = 9;

/**
 * Inline reschedule flow for the receipt page. Two steps:
 * - Pick a new date (calendar, only future days with at least one free slot).
 * - Pick a new time slot (filtered against the OTHER reservations on the
 *   same date — current reservation's own slots are excluded).
 * Same code is preserved on confirm. See Decision Notes in COMMIT message.
 */
export default function RescheduleFlow({
  reserva,
  servicio,
  onConfirm,
  onCancel,
}: RescheduleFlowProps): JSX.Element {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [newFecha, setNewFecha] = useState<string | null>(null);
  const [newHora, setNewHora] = useState<string | null>(null);

  useEffect(() => {
    setReservas(cargarReservas());
    setHydrated(true);
  }, []);

  // Build the calendar cursor starting from today (rescheduling past is
  // never meaningful — we want to move the booking FORWARD).
  const [cursor, setCursor] = useState<{ y: number; m: number }>(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() };
  });
  const t = new Date();
  t.setHours(0, 0, 0, 0);

  const slots = useMemo(() => {
    return generarSlots(HORARIO_INICIO, HORARIO_FIN_INCLUSIVE, 30).filter((s) => {
      return cmpHHMM(addMinutes(s, servicio.duracionMin), "20:00") <= 0;
    });
  }, [servicio.duracionMin]);

  // For slot occupancy: temporarily remove THIS reservation from the list
  // so we don't conflict with ourselves.
  const reservasSinMias = useMemo(
    () => reservas.filter((r) => r.codigo !== reserva.codigo),
    [reservas, reserva.codigo],
  );

  const ocupados = useMemo(() => {
    if (!newFecha) return new Set<string>();
    return slotsOcupados(reservasSinMias, newFecha, reserva.profesionalId);
  }, [reservasSinMias, newFecha, reserva.profesionalId]);

  const profesionalesDisponibles = useMemo(() => {
    if (!newFecha) return profesionales;
    const wd = isoWeekday(fromIsoDate(newFecha));
    return profesionales.filter((p) => p.diasTrabajo.includes(wd));
  }, [newFecha]);

  // Calendar grid (Monday-first).
  const firstWd = (() => {
    const d = new Date(cursor.y, cursor.m, 1);
    const w = d.getDay();
    return (w + 6) % 7;
  })();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: { date: Date | null; iso: string | null }[] = [];
  for (let i = 0; i < firstWd; i++) cells.push({ date: null, iso: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(cursor.y, cursor.m, d);
    cells.push({ date: dt, iso: toIsoDate(dt) });
  }
  const canGoPrev =
    new Date(cursor.y, cursor.m - 1, 1).getTime() >=
    new Date(t.getFullYear(), t.getMonth(), 1).getTime();
  const goPrev = () => {
    if (!canGoPrev) return;
    setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }));
  };
  const goNext = () => {
    setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }));
  };

  const handleConfirm = () => {
    if (!newFecha || !newHora) return;
    const validacion = validarSlotLibre(reservasSinMias, {
      fecha: newFecha,
      hora: newHora,
      duracionMin: servicio.duracionMin,
      profesionalId: reserva.profesionalId,
    });
    if (!validacion.ok) {
      // eslint-disable-next-line no-alert
      alert(validacion.motivo);
      return;
    }
    const updated: Reserva = {
      ...reserva,
      fecha: newFecha,
      hora: newHora,
    };
    const nuevas = reservas.map((r) => (r.codigo === reserva.codigo ? updated : r));
    guardarReservas(nuevas);
    setReservas(nuevas);
    onConfirm(updated);
  };

  const profesionalLabel =
    reserva.profesionalId === "cualquiera"
      ? "Cualquiera disponible"
      : profesionalPorId(reserva.profesionalId)?.nombre ?? "";

  return (
    <div class="rounded-[var(--radius-input)] border border-[rgba(31,24,18,0.08)] bg-[var(--color-paper-3)] p-5">
      <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
        Reagendar
      </p>
      <p class="mt-2 font-serif text-[18px] leading-[1.2] text-[var(--color-ink)]">
        Elegí un nuevo día y horario.
      </p>
      <p class="mt-1.5 text-[13px] text-[var(--color-ink-2)]">
        Mantenés el mismo código ({reserva.codigo}) y el/la profesional asignado/a.
      </p>

      {!hydrated && (
        <p class="mt-4 text-[13px] text-[var(--color-muted)]">Cargando disponibilidad…</p>
      )}

      {hydrated && (
        <>
          {/* Mini calendar */}
          <div class="mt-5 overflow-hidden rounded-[var(--radius-card)] border border-[rgba(31,24,18,0.08)]">
            <div
              class="flex items-center justify-between px-4 py-3 sm:px-6"
              style="background: var(--color-paper-2);"
            >
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-300 disabled:opacity-30"
                style="background: rgba(31,24,18,0.06); color: var(--color-ink);"
                onClick={goPrev}
                disabled={!canGoPrev}
                aria-label="Mes anterior"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M8 2 4 6l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <span class="font-serif text-[16px] capitalize text-[var(--color-ink)]">
                {MESES[cursor.m]} {cursor.y}
              </span>
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-300"
                style="background: rgba(31,24,18,0.06); color: var(--color-ink);"
                onClick={goNext}
                aria-label="Mes siguiente"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M4 2 8 6l-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
            <div class="px-4 pb-4 sm:px-6">
              <div class="grid grid-cols-7 gap-1.5 text-center font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
                {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
                  <span key={d} class="py-2">{d}</span>
                ))}
              </div>
              <div class="grid grid-cols-7 gap-1.5">
                {cells.map((cell, idx) => {
                  if (!cell.date || !cell.iso) {
                    return <span key={idx} class="aspect-square" aria-hidden="true" />;
                  }
                  const inPast = fromIsoDate(cell.iso).getTime() < t.getTime();
                  const wd = isoWeekday(cell.date);
                  const isSunday = wd === 7;
                  const isWorking = profesionalesDisponibles.some((p) =>
                    p.diasTrabajo.includes(wd),
                  );
                  const isSame = cell.iso === reserva.fecha;
                  const disabled = inPast || isSunday || !isWorking || isSame;
                  const selected = newFecha === cell.iso;
                  return (
                    <button
                      key={cell.iso}
                      type="button"
                      class="aspect-square rounded-[10px] text-[14px] tabular-nums transition-all duration-300"
                      style={{
                        background: selected
                          ? "var(--color-clay)"
                          : "transparent",
                        color: selected
                          ? "var(--color-paper-2)"
                          : disabled
                          ? "rgba(31,24,18,0.28)"
                          : "var(--color-ink)",
                        border: selected
                          ? "1px solid var(--color-clay)"
                          : "1px solid rgba(31,24,18,0.1)",
                        cursor: disabled ? "not-allowed" : "pointer",
                      }}
                      onClick={() => {
                        if (!disabled) {
                          setNewFecha(cell.iso);
                          setNewHora(null);
                        }
                      }}
                      disabled={disabled}
                      aria-pressed={selected}
                      aria-label={`${formatFechaLarga(cell.iso)}${disabled ? ", no disponible" : ""}`}
                    >
                      {cell.date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Slot picker */}
          {newFecha && (
            <div class="mt-5">
              <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
                {formatFechaLarga(newFecha)} · {profesionalLabel}
              </p>
              <div class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((s) => {
                  const busy = ocupados.has(s);
                  const selected = newHora === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={busy}
                      class={`slot ${selected ? "slot-selected" : ""} ${busy ? "slot-busy" : ""}`}
                      onClick={() => !busy && setNewHora(s)}
                      aria-pressed={selected}
                    >
                      {formatHora(s)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div class="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              class="btn-pill btn-primary"
              disabled={!newFecha || !newHora}
              onClick={handleConfirm}
              style={{
                opacity: newFecha && newHora ? 1 : 0.5,
                pointerEvents: newFecha && newHora ? "auto" : "none",
              }}
            >
              <span>Confirmar reagenda</span>
            </button>
            <button type="button" class="btn-pill btn-ghost" onClick={onCancel}>
              <span>Cancelar</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
