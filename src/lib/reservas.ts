import type { Reserva, ReservaInput } from "./types";
import { cmpHHMM, addMinutes } from "./horarios";

const STORAGE_KEY = "aurora.reservas.v1";

const isBrowser = (): boolean => typeof window !== "undefined";

/** Back-compat shim — old records may not carry `servicioIds` / `duracionTotalMin`. */
const normalize = (raw: unknown): Reserva[] => {
  if (!Array.isArray(raw)) return [];
  const out: Reserva[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const codigo = typeof r["codigo"] === "string" ? (r["codigo"] as string) : "";
    const servicioId = typeof r["servicioId"] === "string" ? (r["servicioId"] as string) : "";
    const profesionalId =
      typeof r["profesionalId"] === "string" ? (r["profesionalId"] as string) : "";
    const fecha = typeof r["fecha"] === "string" ? (r["fecha"] as string) : "";
    const hora = typeof r["hora"] === "string" ? (r["hora"] as string) : "";
    const duracionMin = typeof r["duracionMin"] === "number" ? (r["duracionMin"] as number) : 0;
    const cliente = (r["cliente"] as Record<string, unknown>) ?? {};
    const creadaEn = typeof r["creadaEn"] === "string" ? (r["creadaEn"] as string) : "";
    if (!codigo || !servicioId || !profesionalId || !fecha || !hora || !creadaEn) continue;

    const servicioIds: string[] = Array.isArray(r["servicioIds"])
      ? (r["servicioIds"] as unknown[]).filter((x): x is string => typeof x === "string")
      : [servicioId];
    const duracionTotalMin =
      typeof r["duracionTotalMin"] === "number"
        ? (r["duracionTotalMin"] as number)
        : duracionMin;

    let cancelada: Reserva["cancelada"] | undefined;
    const c = r["cancelada"];
    if (c && typeof c === "object") {
      const motivo = (c as Record<string, unknown>)["motivo"];
      const nota = (c as Record<string, unknown>)["nota"];
      const cuando = (c as Record<string, unknown>)["cuando"];
      if (typeof motivo === "string" && typeof cuando === "string") {
        cancelada = {
          motivo,
          nota: typeof nota === "string" ? nota : undefined,
          cuando,
        };
      }
    }

    const notasRaw = cliente["notas"];
    const reserva: Reserva = {
      codigo,
      servicioId: servicioId as Reserva["servicioId"],
      servicioIds: servicioIds as Reserva["servicioIds"],
      profesionalId: profesionalId as Reserva["profesionalId"],
      fecha,
      hora,
      duracionMin,
      duracionTotalMin,
      cliente: {
        nombre: typeof cliente["nombre"] === "string" ? (cliente["nombre"] as string) : "",
        telefono: typeof cliente["telefono"] === "string" ? (cliente["telefono"] as string) : "",
        email: typeof cliente["email"] === "string" ? (cliente["email"] as string) : "",
        notas: typeof notasRaw === "string" && notasRaw.trim() ? notasRaw : undefined,
      },
      creadaEn,
      cancelada,
    };
    out.push(reserva);
  }
  return out;
};

export const cargarReservas = (): Reserva[] => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalize(JSON.parse(raw));
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

/** Mark a reservation as cancelled with reason and optional note (audit trail). */
export const cancelarReservaConMotivo = (
  codigo: string,
  motivo: string,
  nota?: string,
): Reserva[] => {
  const actuales = cargarReservas();
  const cuando = new Date().toISOString();
  const siguientes = actuales.map((r) =>
    r.codigo === codigo
      ? {
          ...r,
          cancelada: {
            motivo,
            nota: nota && nota.trim() ? nota.trim() : undefined,
            cuando,
          },
        }
      : r,
  );
  guardarReservas(siguientes);
  return siguientes;
};

/** Reservations whose phone matches (digits-only compare, ignore + and spaces). */
export const reservasPorTelefono = (telefono: string): Reserva[] => {
  const todas = cargarReservas();
  const norm = telefono.replace(/\D/g, "");
  if (!norm) return [];
  return todas.filter((r) => r.cliente.telefono.replace(/\D/g, "") === norm);
};

/** Reservations on a given date, sorted by time. */
export const reservasPorFecha = (reservas: Reserva[], fecha: string): Reserva[] => {
  return reservas
    .filter((r) => r.fecha === fecha)
    .sort((a, b) => cmpHHMM(a.hora, b.hora));
};

/** Group reservations by ISO date — used by the admin panel. */
export const agruparPorFecha = (
  reservas: Reserva[],
): { fecha: string; items: Reserva[] }[] => {
  const map = new Map<string, Reserva[]>();
  for (const r of reservas) {
    const arr = map.get(r.fecha) ?? [];
    arr.push(r);
    map.set(r.fecha, arr);
  }
  const out = Array.from(map.entries()).map(([fecha, items]) => ({
    fecha,
    items: items.sort((a, b) => cmpHHMM(a.hora, b.hora)),
  }));
  out.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return out;
};

/**
 * Returns the set of HH:MM slots that are already occupied by a professional
 * on a given date. A reservation blocks its starting slot and any subsequent
 * slot the service duration covers. Uses `duracionTotalMin` so chained
 * services occupy the full block, not just the primary.
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
    const duracion = r.duracionTotalMin || r.duracionMin;
    const finMarca = addMinutes(r.hora, Math.max(0, duracion - 1));
    let cursor = r.hora;
    while (cmpHHMM(cursor, finMarca) <= 0) {
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
 * professional (or any professional, when "cualquiera"). Uses the total
 * chained duration to compute the new window.
 */
export const validarSlotLibre = (
  reservas: Reserva[],
  nueva: Pick<
    ReservaInput,
    "fecha" | "hora" | "duracionTotalMin" | "profesionalId"
  >,
): { ok: true } | { ok: false; motivo: string } => {
  const inicioNueva = nueva.hora;
  const finNueva = addMinutes(nueva.hora, nueva.duracionTotalMin);

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
    const duracionExistente = r.duracionTotalMin || r.duracionMin;
    const finExistente = addMinutes(r.hora, duracionExistente);
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