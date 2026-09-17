// Per-reservation completion state (separate from aurora.reservas because
// the Reserva type is locked — no extra fields). Stored as a flat map
// keyed by codigo.

export type EstadoReserva = "completada";

const STORAGE_KEY = "aurora.estado.v1";

const isBrowser = (): boolean => typeof window !== "undefined";

type EstadoMap = Record<string, EstadoReserva>;

const sanitize = (raw: unknown): EstadoMap => {
  if (!raw || typeof raw !== "object") return {};
  const out: EstadoMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === "completada") out[k] = "completada";
  }
  return out;
};

export const cargarEstados = (): EstadoMap => {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return sanitize(JSON.parse(raw));
  } catch {
    return {};
  }
};

const persistir = (m: EstadoMap): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {
    // Silent fallback.
  }
};

export const marcarCompletada = (codigo: string): EstadoMap => {
  const m = cargarEstados();
  if (m[codigo] === "completada") return m;
  const next = { ...m, [codigo]: "completada" as EstadoReserva };
  persistir(next);
  return next;
};

export const desmarcarCompletada = (codigo: string): EstadoMap => {
  const m = cargarEstados();
  if (!(codigo in m)) return m;
  const next = { ...m };
  delete next[codigo];
  persistir(next);
  return next;
};

export const esCompletada = (codigo: string): boolean => {
  return cargarEstados()[codigo] === "completada";
};
