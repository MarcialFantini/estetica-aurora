// Shared types between Astro pages and Preact islands.

export type ServicioId =
  | "corte-dama"
  | "corte-caballero"
  | "corte-nino"
  | "flequillo"
  | "coloracion"
  | "mechas"
  | "balayage"
  | "matiz"
  | "alisado"
  | "keratina"
  | "hidratacion"
  | "cauterizacion"
  | "tratamiento-premium"
  | "brushing"
  | "peinado-evento"
  | "recogido"
  | "manicura"
  | "depilacion-facial";

export type CategoriaServicio =
  | "corte"
  | "color"
  | "tratamiento"
  | "peinado"
  | "estetica";

export interface Servicio {
  id: ServicioId;
  nombre: string;
  descripcion: string;
  duracionMin: 15 | 30 | 45 | 60 | 90 | 120 | 150;
  precio: number;
  categoria: CategoriaServicio;
  destacado?: boolean;
  /** Optional second service that can be chained in the same appointment. */
  encadenableCon?: ServicioId[];
}

export type ProfesionalId = "lucia" | "carlos" | "camila" | "joaquin" | "daniela";

export interface Profesional {
  id: ProfesionalId;
  nombre: string;
  /** Short specialty tag (one line). */
  especialidad: string;
  /** Longer bio shown on /equipo. */
  bio: string;
  aniosExperiencia: number;
  /** ISO weekday (1=Mon, 7=Sun) on which this professional works. */
  diasTrabajo: number[];
  /** Optional initials avatar fallback. */
  iniciales?: string;
}

export interface Reserva {
  codigo: string;
  /** Primary service. Multi-service bookings use servicioIds + duracionTotalMin. */
  servicioId: ServicioId;
  /** All services when chained; otherwise [servicioId]. */
  servicioIds: ServicioId[];
  profesionalId: ProfesionalId | "cualquiera";
  /** ISO date string YYYY-MM-DD */
  fecha: string;
  /** 24h time HH:MM — start of the entire block. */
  hora: string;
  /** Duration of the primary service. Kept for back-compat with old receipts. */
  duracionMin: number;
  /** Total duration of all chained services in minutes. */
  duracionTotalMin: number;
  cliente: {
    nombre: string;
    telefono: string;
    email: string;
    notas?: string;
  };
  creadaEn: string; // ISO timestamp
  /** Optional cancellation audit (set when /cancelar/[codigo] flow runs). */
  cancelada?: {
    motivo: string;
    nota?: string;
    cuando: string; // ISO timestamp
  };
}

/** Slim input for validation helpers — without the cliente block. */
export interface ReservaInput {
  servicioId: ServicioId;
  servicioIds: ServicioId[];
  profesionalId: ProfesionalId | "cualquiera";
  fecha: string;
  hora: string;
  duracionMin: number;
  duracionTotalMin: number;
}

export interface Slot {
  /** 24h HH:MM */
  hora: string;
  /** True if at least one professional on shift can take this slot. */
  disponible: boolean;
  /** Professionals who already have a reservation covering this slot. */
  ocupados: ProfesionalId[];
}
