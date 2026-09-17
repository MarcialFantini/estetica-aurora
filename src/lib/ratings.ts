// Ratings storage + aggregation.
// One localStorage key: aurora.ratings.v1
// Shape: { estilistaId, reservaId, rating (1..5), comentario?, fecha (ISO) }

export interface Rating {
  estilistaId: string;
  reservaId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comentario?: string;
  fecha: string; // ISO timestamp
}

export interface RatingAggregate {
  count: number;
  promedio: number; // 0 when count=0
}

const STORAGE_KEY = "aurora.ratings.v1";

const isBrowser = (): boolean => typeof window !== "undefined";

const sanitize = (raw: unknown): Rating[] => {
  if (!Array.isArray(raw)) return [];
  const out: Rating[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const id = typeof o["estilistaId"] === "string" ? (o["estilistaId"] as string) : "";
    const rid = typeof o["reservaId"] === "string" ? (o["reservaId"] as string) : "";
    const val = typeof o["rating"] === "number" ? (o["rating"] as number) : NaN;
    const fecha = typeof o["fecha"] === "string" ? (o["fecha"] as string) : "";
    if (!id || !rid || !fecha) continue;
    if (val < 1 || val > 5) continue;
    const r2: Rating = {
      estilistaId: id,
      reservaId: rid,
      rating: Math.round(val) as 1 | 2 | 3 | 4 | 5,
      fecha,
    };
    const c = o["comentario"];
    if (typeof c === "string" && c.trim()) r2.comentario = c.trim();
    out.push(r2);
  }
  return out;
};

export const cargarRatings = (): Rating[] => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return sanitize(JSON.parse(raw));
  } catch {
    return [];
  }
};

const persistir = (rs: Rating[]): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rs));
  } catch {
    // Silent fallback.
  }
};

export const guardarRating = (r: Rating): Rating[] => {
  const actuales = cargarRatings();
  // One rating per reservaId — second submit overwrites.
  const idx = actuales.findIndex((x) => x.reservaId === r.reservaId);
  const siguientes = idx >= 0 ? actuales.map((x, i) => (i === idx ? r : x)) : [...actuales, r];
  persistir(siguientes);
  return siguientes;
};

export const eliminarRating = (reservaId: string): Rating[] => {
  const actuales = cargarRatings();
  const siguientes = actuales.filter((x) => x.reservaId !== reservaId);
  persistir(siguientes);
  return siguientes;
};

export const ratingPorReserva = (reservaId: string): Rating | undefined => {
  return cargarRatings().find((r) => r.reservaId === reservaId);
};

export const ratingsPorEstilista = (estilistaId: string): Rating[] => {
  return cargarRatings().filter((r) => r.estilistaId === estilistaId);
};

export const agregadosPorEstilista = (
  estilistaId: string,
  cache?: Rating[],
): RatingAggregate => {
  const rs = cache ?? ratingsPorEstilista(estilistaId);
  if (rs.length === 0) return { count: 0, promedio: 0 };
  const sum = rs.reduce((acc, r) => acc + r.rating, 0);
  return { count: rs.length, promedio: sum / rs.length };
};

/** Bulk aggregate for a list of ids. Used by the profesional picker so we
 *  read localStorage once per render, not once per card. */
export const agregadosPorEstilistas = (
  ids: string[],
): Record<string, RatingAggregate> => {
  const all = cargarRatings();
  const out: Record<string, RatingAggregate> = {};
  for (const id of ids) {
    const rs = all.filter((r) => r.estilistaId === id);
    if (rs.length === 0) {
      out[id] = { count: 0, promedio: 0 };
    } else {
      const sum = rs.reduce((acc, r) => acc + r.rating, 0);
      out[id] = { count: rs.length, promedio: sum / rs.length };
    }
  }
  return out;
};
