// Shared types between Astro pages and Preact islands.

export type ServicioId = "corte" | "color" | "brushing" | "tratamiento" | "ninos" | "diseno";

export interface Servicio {
  id: ServicioId;
  nombre: string;
  descripcion: string;
  duracionMin: 30 | 45 | 60 | 90 | 120;
  precio: number;
  destacado?: boolean;
}

export type ProfesionalId = "ana" | "bruno" | "camila";

export interface Profesional {
  id: ProfesionalId;
  nombre: string;
  especialidad: string;
  bio: string;
  aniosExperiencia: number;
  /** ISO weekday (1=Mon, 7=Sun) on which this professional works. */
  diasTrabajo: number[];
}

export interface Reserva {
  codigo: string;
  servicioId: ServicioId;
  profesionalId: ProfesionalId | "cualquiera";
  /** ISO date string YYYY-MM-DD */
  fecha: string;
  /** 24h time HH:MM */
  hora: string;
  /** Slot duration in minutes, derived from service but stored for clarity. */
  duracionMin: number;
  cliente: {
    nombre: string;
    telefono: string;
    email: string;
    notas?: string;
  };
  creadaEn: string; // ISO timestamp
}

export interface Slot {
  /** 24h HH:MM */
  hora: string;
  /** True if at least one professional on shift can take this slot. */
  disponible: boolean;
  /** Professionals who already have a reservation covering this slot. */
  ocupados: ProfesionalId[];
}