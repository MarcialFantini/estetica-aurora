import type { Reserva } from "./types";
import { cmpHHMM, addMinutes } from "./horarios";

const STORAGE_KEY = "aurora.reservas.v1";

const isBrowser = (): boolean => typeof window !== "undefined";

export const cargarReservas = (): Reserva[] => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Reserva[];
  } catch {
    return [];
  }
};

export const guardarReservas = (reservas: Reserva[]): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reservas));
  } catch {
    // Storage quota / disabled. Silent fallback.
  }
};

export const agregarReserva = (reserva: Reserva): Reserva[] => {
  const actuales = cargarReservas();
  const siguientes = [...actuales, reserva];
  guardarReservas(siguientes);
  return siguientes;
};

export const buscarReservaPorCodigo = (codigo: string): Reserva | undefined => {
  const todas = cargarReservas();
  return todas.find((r) => r.codigo === codigo);
};

export const eliminarReservaPorCodigo = (codigo: string): Reserva[] => {
  const actuales = cargarReservas();
  const siguientes = actuales.filter((r) => r.codigo !== codigo);
  guardarReservas(siguientes);
  return siguientes;
};

/**
 * Returns the set of HH:MM slots that are already occupied by a professional
 * on a given date. A reservation blocks its starting slot and any subsequent
 * slot the service duration covers.
 */
export const slotsOcupados = (
  reservas: Reserva[],
  fecha: string,
  profesionalId: string | "cualquiera",
): Set<string> => {
  const out = new Set<string>();
  for (const r of reservas) {
    if (r.fecha !== fecha) continue;
    if (profesionalId !== "cualquiera" && r.profesionalId !== profesionalId) continue;
    let cursor = r.hora;
    // Mark the starting slot and the ones it covers, up to duracionMin.
    while (cmpHHMM(cursor, addMinutes(r.hora, r.duracionMin - 1)) <= 0) {
      out.add(cursor);
      cursor = addMinutes(cursor, 30);
    }
  }
  return out;
};

/**
 * Count reservations assigned to a given professional (or "cualquiera") on a
 * specific date. Used to throttle availability per day — when the count
 * crosses the saturation threshold the picker hides the professional.
 */
export const contarReservasPorProfesionalEnFecha = (
  reservas: Reserva[],
  fecha: string,
  profesionalId: string,
): number => {
  let n = 0;
  for (const r of reservas) {
    if (r.fecha !== fecha) continue;
    if (r.profesionalId === profesionalId) n++;
  }
  return n;
};

/**
 * True if `nueva` does not overlap any existing reservation for the chosen
 * professional (or any professional, when "cualquiera").
 */
export const validarSlotLibre = (
  reservas: Reserva[],
  nueva: Pick<Reserva, "fecha" | "hora" | "duracionMin" | "profesionalId">,
): { ok: true } | { ok: false; motivo: string } => {
  const inicioNueva = nueva.hora;
  const finNueva = addMinutes(nueva.hora, nueva.duracionMin);

  for (const r of reservas) {
    if (r.fecha !== nueva.fecha) continue;
    if (
      nueva.profesionalId !== "cualquiera" &&
      r.profesionalId !== "cualquiera" &&
      r.profesionalId !== nueva.profesionalId
    ) {
      continue;
    }
    const inicioExistente = r.hora;
    const finExistente = addMinutes(r.hora, r.duracionMin);
    const overlap = cmpHHMM(inicioNueva, finExistente) < 0 && cmpHHMM(inicioExistente, finNueva) < 0;
    if (overlap) {
      if (nueva.profesionalId !== "cualquiera") {
        return { ok: false, motivo: "Ese horario ya está reservado para ese profesional." };
      }
      return { ok: false, motivo: "Ese horario está ocupado por otro turno." };
    }
  }
  return { ok: true };
};