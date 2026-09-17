// Utilities for formatting, date math and slot generation.
// All timezone-agnostic. Uses the user's local browser date for "today".

export const HORARIO_INICIO = 9; // 09:00
export const HORARIO_FIN = 19; // 19:00 inclusive as last start
export const HORARIO_INICIO_STR = "09:00";
export const HORARIO_FIN_STR = "19:00";

export const DIAS_SEMANA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

/** Build slot times between start and end hours. Step is configurable. */
export const generarSlots = (
  inicio: number = HORARIO_INICIO,
  fin: number = HORARIO_FIN,
  pasoMin: 30 | 60 = 30,
): string[] => {
  const out: string[] = [];
  const paso = pasoMin / 60;
  for (let h = inicio; h <= fin; h += paso) {
    const hh = Math.floor(h).toString().padStart(2, "0");
    const mm = h % 1 === 0 ? "00" : "30";
    out.push(`${hh}:${mm}`);
  }
  return out;
};

/** Pad to ISO weekday: JS Sunday=0 → 7. */
export const isoWeekday = (date: Date): number => {
  const d = date.getDay();
  return d === 0 ? 7 : d;
};

/** YYYY-MM-DD in local time. */
export const toIsoDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const fromIsoDate = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

/** Human readable short date. "Mar 15, mar". */
export const formatFechaCorta = (iso: string): string => {
  const d = fromIsoDate(iso);
  const dow = DIAS_SEMANA[isoWeekday(d) - 1].slice(0, 3);
  return `${dow} ${d.getDate()}`;
};

export const formatFechaLarga = (iso: string): string => {
  const d = fromIsoDate(iso);
  const dow = DIAS_SEMANA[isoWeekday(d) - 1];
  return `${dow} ${d.getDate()} de ${MESES[d.getMonth()]}`;
};

export const formatPrecio = (n: number): string => {
  // Spanish locale, no decimals.
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
};

export const formatHora = (hhmm: string): string => hhmm;

/** Add minutes to HH:MM and return new HH:MM (does not roll over past day). */
export const addMinutes = (hhmm: string, min: number): string => {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + min;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${nh.toString().padStart(2, "0")}:${nm.toString().padStart(2, "0")}`;
};

/** Compare two HH:MM strings. */
export const cmpHHMM = (a: string, b: string): number => {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return (ah ?? 0) - (bh ?? 0) || (am ?? 0) - (bm ?? 0);
};

/** Generate a booking code. Six upper-case chars from a friendly set. */
export const generarCodigoReserva = (): string => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `AUR-${out}`;
};