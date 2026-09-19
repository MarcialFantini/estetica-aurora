// localStorage persistence for in-flight booking drafts.
// Used by BookingIsland so the wizard resumes after refresh.
// Key shape (Versioned so future schema changes can co-exist).
//
// aurora.booking.draft.v1 = {
//   servicioId, servicioIds,
//   profesionalId,
//   fecha, hora,
//   cliente: { nombre, telefono, email, notas },
//   updatedAt: ISO string,
// }

import type { ProfesionalId, ServicioId } from "./types";

const STORAGE_KEY = "aurora.booking.draft.v1";

const isBrowser = (): boolean => typeof window !== "undefined";

export interface BookingDraft {
  servicioId: ServicioId | null;
  servicioIds: ServicioId[];
  profesionalId: ProfesionalId | "cualquiera" | null;
  fecha: string | null;
  hora: string | null;
  step?: string;
  cliente: {
    nombre: string;
    telefono: string;
    email: string;
    notas: string;
  };
  updatedAt: string;
}

export const emptyDraft = (): BookingDraft => ({
  servicioId: null,
  servicioIds: [],
  profesionalId: null,
  fecha: null,
  hora: null,
  cliente: { nombre: "", telefono: "", email: "", notas: "" },
  updatedAt: new Date(0).toISOString(),
});

const sanitize = (raw: unknown): BookingDraft | null => {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const c = (o["cliente"] as Record<string, unknown>) ?? {};
  return {
    servicioId:
      typeof o["servicioId"] === "string" ? (o["servicioId"] as ServicioId) : null,
    servicioIds: Array.isArray(o["servicioIds"])
      ? (o["servicioIds"] as unknown[]).filter(
          (x): x is ServicioId => typeof x === "string",
        )
      : [],
    profesionalId:
      typeof o["profesionalId"] === "string"
        ? (o["profesionalId"] as ProfesionalId | "cualquiera")
        : null,
    fecha: typeof o["fecha"] === "string" ? (o["fecha"] as string) : null,
    hora: typeof o["hora"] === "string" ? (o["hora"] as string) : null,
    step: typeof o["step"] === "string" ? o["step"] : undefined,
    cliente: {
      nombre: typeof c["nombre"] === "string" ? (c["nombre"] as string) : "",
      telefono: typeof c["telefono"] === "string" ? (c["telefono"] as string) : "",
      email: typeof c["email"] === "string" ? (c["email"] as string) : "",
      notas: typeof c["notas"] === "string" ? (c["notas"] as string) : "",
    },
    updatedAt:
      typeof o["updatedAt"] === "string"
        ? (o["updatedAt"] as string)
        : new Date().toISOString(),
  };
};

export const cargarDraft = (): BookingDraft | null => {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return sanitize(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const guardarDraft = (draft: BookingDraft): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Silent fallback.
  }
};

export const limpiarDraft = (): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silent fallback.
  }
};