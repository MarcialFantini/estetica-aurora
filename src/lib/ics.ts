// Generate an RFC 5545 .ics calendar invite for a reservation. The file is
// returned as a Blob ready to be downloaded.

import type { Reserva } from "./types";
import { profesionalPorId, servicioPorId } from "../data/servicios";
import { addMinutes, fromIsoDate } from "./horarios";

const pad = (n: number): string => n.toString().padStart(2, "0");

/** Date in floating local time (no Z suffix) — TZID field carries Argentina. */
const formatLocalICS = (date: Date): string => {
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    "00"
  );
};

const escapeICS = (s: string): string =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

/** Build a downloadable .ics file Blob. Argentina TZ (UTC-03:00). */
export const buildICSBlob = (reserva: Reserva): Blob => {
  const servicio = servicioPorId(reserva.servicioId);
  const profesional = profesionalPorId(reserva.profesionalId);
  const profesionalLabel =
    reserva.profesionalId === "cualquiera"
      ? "Cualquiera disponible"
      : profesional?.nombre ?? "Profesional Aurora";

  const [hh, mm] = reserva.hora.split(":").map(Number);
  const start = fromIsoDate(reserva.fecha);
  start.setHours(hh ?? 9, mm ?? 0, 0, 0);
  const duracion = reserva.duracionTotalMin || reserva.duracionMin;
  const end = new Date(start.getTime() + duracion * 60_000);

  const summary = `${servicio?.nombre ?? "Reserva Aurora"} · Estética Aurora`;
  const description =
    `Reserva ${reserva.codigo} en Estética Aurora.\n` +
    `Servicio: ${servicio?.nombre ?? reserva.servicioId}\n` +
    `Profesional: ${profesionalLabel}\n` +
    `Cliente: ${reserva.cliente.nombre}\n` +
    (reserva.cliente.notas ? `Notas: ${reserva.cliente.notas}` : "");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Estética Aurora//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${reserva.codigo}@aurora.local`,
    `DTSTAMP:${formatLocalICS(new Date())}`,
    `DTSTART;TZID=America/Argentina/Buenos_Aires:${formatLocalICS(start)}`,
    `DTEND;TZID=America/Argentina/Buenos_Aires:${formatLocalICS(end)}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS("Av. de los Aromos 1420, Centro")}`,
    `STATUS:CONFIRMED`,
    `ORGANIZER;CN=Estética Aurora:mailto:reservas@aurora.local`,
    `ATTENDEE;CN=${escapeICS(reserva.cliente.nombre)};RSVP=TRUE:mailto:${reserva.cliente.email}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
};

/** Trigger a download of the .ics file for the given reservation. */
export const descargarICS = (reserva: Reserva): void => {
  const blob = buildICSBlob(reserva);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reserva-${reserva.codigo}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so Firefox/Safari finish the navigation.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};