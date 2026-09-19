/** @jsxImportSource preact */
import { useEffect, useMemo, useState } from "preact/hooks";
import type { JSX } from "preact";
import { profesionalPorId, servicioPorId } from "../../data/servicios";
import { reservasPorTelefono } from "../../lib/reservas";
import type { Reserva } from "../../lib/types";
import {
  addMinutes,
  formatFechaCorta,
  formatFechaLarga,
  formatHora,
  formatPrecio,
  fromIsoDate,
  isoWeekday,
} from "../../lib/horarios";
import { DIAS_SEMANA } from "../../lib/horarios";

type Group = "proximas" | "completadas" | "canceladas" | "pasadas";

interface GroupedList {
  group: Group;
  label: string;
  blurb: string;
  items: Reserva[];
}

const normalizePhone = (raw: string): string => raw.replace(/\D/g, "");

const validate = (raw: string): string | null => {
  const norm = normalizePhone(raw);
  if (!norm) return "Ingresá un teléfono.";
  if (norm.length < 6) return "Demasiado corto. Verificá el número.";
  if (norm.length > 20) return "Demasiado largo. Verificá el código de país.";
  return null;
};

const grupoficar = (reservas: Reserva[]): GroupedList[] => {
  const ahora = Date.now();
  const grupos: Record<Group, Reserva[]> = {
    proximas: [],
    pasadas: [],
    completadas: [],
    canceladas: [],
  };
  for (const r of reservas) {
    if (r.cancelada) {
      grupos.canceladas.push(r);
      continue;
    }
    const [hh, mm] = r.hora.split(":").map(Number);
    const f = fromIsoDate(r.fecha);
    f.setHours(hh ?? 0, mm ?? 0, 0, 0);
    const fin = f.getTime() + ((r.duracionTotalMin || r.duracionMin) * 60_000);
    if (fin < ahora) grupos.pasadas.push(r);
    else grupos.proximas.push(r);
  }
  // Move "pasadas" entries that were marked completed via the receipt page.
  // We don't have completion status here; just present "pasadas" as the catch-all.
  const out: GroupedList[] = [
    {
      group: "proximas",
      label: "Próximas",
      blurb: "Tus reservas activas.",
      items: grupos.proximas.sort((a, b) =>
        (a.fecha + a.hora).localeCompare(b.fecha + b.hora),
      ),
    },
    {
      group: "pasadas",
      label: "Pasadas",
      blurb: "Turnos que ya ocurrieron.",
      items: grupos.pasadas.sort((a, b) =>
        (b.fecha + b.hora).localeCompare(a.fecha + a.hora),
      ),
    },
    {
      group: "canceladas",
      label: "Canceladas",
      blurb: "Reservas que se liberaron.",
      items: grupos.canceladas.sort((a, b) =>
        (b.fecha + b.hora).localeCompare(a.fecha + a.hora),
      ),
    },
  ];
  return out;
};

export default function HistorialLookup(): JSX.Element {
  const [telefono, setTelefono] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [results, setResults] = useState<Reserva[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const onSubmit = (e: Event) => {
    e.preventDefault();
    const v = validate(telefono);
    if (v) {
      setError(v);
      setSubmitted(null);
      setResults([]);
      return;
    }
    const norm = normalizePhone(telefono);
    setError(null);
    setSubmitted(norm);
    setResults(reservasPorTelefono(norm));
  };

  const grupos = useMemo(() => grupoficar(results), [results]);

  const total = results.length;

  return (
    <div>
      <form
        class="bezel-shell"
        onSubmit={onSubmit}
        noValidate
      >
        <div
          class="bezel-core flex flex-col gap-4 p-6 sm:p-8"
          style="background: var(--color-paper-2);"
        >
          <header>
            <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
              Buscar mis reservas
            </p>
            <h2 class="mt-2 font-serif text-[24px] leading-[1.15] text-[var(--color-ink)]">
              Ingresá tu teléfono para ver tu historial.
            </h2>
            <p class="mt-2 text-[14px] text-[var(--color-ink-2)]">
              La búsqueda recorre solo este navegador. Si hiciste reservas desde
              otro dispositivo, no las vamos a encontrar acá.
            </p>
          </header>
          <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label
                class="block text-[13px] font-medium text-[var(--color-ink)]"
                for="telefono"
              >
                Teléfono
              </label>
              <input
                id="telefono"
                type="tel"
                placeholder="+54 9 11 5555-1234"
                autocomplete="tel"
                value={telefono}
                onInput={(e) =>
                  setTelefono((e.currentTarget as HTMLInputElement).value)
                }
                class={`field mt-1.5 ${error ? "field-error" : ""}`}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "telefono-error" : undefined}
              />
              {error && (
                <p
                  id="telefono-error"
                  class="mt-1.5 text-[12px] text-[var(--color-clay)]"
                >
                  {error}
                </p>
              )}
            </div>
            <div class="flex items-end">
              <button
                type="submit"
                class="btn-pill btn-primary w-full justify-center sm:w-auto"
              >
                <span>Buscar</span>
                <span class="icon-bubble !h-5 !w-5" aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {submitted && hydrated && (
        <section class="mt-8" aria-live="polite">
          <header class="flex flex-wrap items-baseline justify-between gap-2">
            <h3 class="font-serif text-[20px] leading-tight text-[var(--color-ink)]">
              Resultados para{" "}
              <span class="font-mono tabular-nums">{submitted}</span>
            </h3>
            <p class="text-[12px] text-[var(--color-muted)]">
              {total === 0
                ? "Sin coincidencias."
                : `${total} reserva${total === 1 ? "" : "s"} encontrada${total === 1 ? "" : "s"}.`}
            </p>
          </header>

          {total === 0 ? (
            <div class="mt-6 flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[rgba(31,24,18,0.18)] p-8 text-center"
              style="background: var(--color-paper-3);"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.5" />
                <path d="m20 20-3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
              <p class="font-serif text-[18px] text-[var(--color-ink)]">
                No encontramos reservas para ese teléfono.
              </p>
              <p class="max-w-[44ch] text-[13px] text-[var(--color-ink-2)]">
                Verificá que esté bien escrito. Si las hiciste desde otro
                navegador, probá desde ahí.
              </p>
              <a href="/reservar" class="btn-pill btn-primary mt-2">
                <span>Sacar un turno</span>
              </a>
            </div>
          ) : (
            <div class="mt-6 grid gap-8">
              {grupos.map((g) =>
                g.items.length === 0 ? null : (
                  <section key={g.group}>
                    <header class="mb-3 flex items-baseline justify-between gap-3">
                      <h4 class="font-serif text-[16px] text-[var(--color-ink)]">
                        {g.label}
                      </h4>
                      <span class="font-mono text-[11px] tabular-nums text-[var(--color-muted)]">
                        {g.items.length}
                      </span>
                    </header>
                    <ul class="grid gap-3">
                      {g.items.map((r) => (
                        <ReservaItem key={r.codigo} reserva={r} />
                      ))}
                    </ul>
                  </section>
                ),
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ReservaItem({ reserva }: { reserva: Reserva }): JSX.Element {
  const servicios = reserva.servicioIds
    .map((id) => servicioPorId(id))
    .filter((s): s is NonNullable<ReturnType<typeof servicioPorId>> => Boolean(s));
  const profesional = profesionalPorId(reserva.profesionalId);
  const profesionalLabel =
    reserva.profesionalId === "cualquiera"
      ? "Cualquiera disponible"
      : profesional?.nombre ?? reserva.profesionalId;

  const [hh, mm] = reserva.hora.split(":").map(Number);
  const fechaLocal = fromIsoDate(reserva.fecha);
  fechaLocal.setHours(hh ?? 0, mm ?? 0, 0, 0);
  const fin = fechaLocal.getTime() + (reserva.duracionTotalMin || reserva.duracionMin) * 60_000;
  const turnoEnPasado = fin < Date.now();

  const dow = DIAS_SEMANA[isoWeekday(fechaLocal) - 1];
  const precioTotal = servicios.reduce((acc, s) => acc + s.precio, 0);

  return (
    <li
      class="rounded-[var(--radius-input)] border border-[rgba(31,24,18,0.08)] p-5"
      style="background: var(--color-paper-2);"
    >
      <div class="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p class="font-serif text-[18px] leading-tight text-[var(--color-ink)]">
            {servicios.map((s) => s.nombre).join(" + ")}
          </p>
          <p class="mt-1 text-[12px] text-[var(--color-muted)]">
            Con {profesionalLabel}
          </p>
        </div>
        <span class="font-mono text-[11px] tabular-nums text-[var(--color-muted)]">
          {reserva.codigo}
        </span>
      </div>
      <p class="mt-3 text-[14px] text-[var(--color-ink-2)]">
        <span class="font-medium text-[var(--color-ink)]">
          {dow} {formatFechaCorta(reserva.fecha)}
        </span>{" "}
        · {formatHora(reserva.hora)} -{" "}
        {formatHora(addMinutes(reserva.hora, reserva.duracionTotalMin || reserva.duracionMin))}
        {" "}· {servicios[0]?.duracionMin ?? reserva.duracionMin} min
      </p>
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(31,24,18,0.08)] pt-4">
        <span class="font-mono text-[13px] tabular-nums text-[var(--color-ink)]">
          {formatPrecio(precioTotal)}
        </span>
        <div class="flex flex-wrap gap-2 text-[13px]">
          <a
            href={`/reservar/${reserva.codigo}`}
            class="rounded-full border border-[rgba(31,24,18,0.18)] px-3 py-1.5 transition-colors hover:border-[var(--color-clay)] hover:text-[var(--color-clay)]"
          >
            Ver comprobante
          </a>
          {!turnoEnPasado && !reserva.cancelada && (
            <a
              href={`/reservar/modificar/${reserva.codigo}`}
              class="rounded-full border border-[rgba(31,24,18,0.18)] px-3 py-1.5 transition-colors hover:border-[var(--color-clay)] hover:text-[var(--color-clay)]"
            >
              Modificar
            </a>
          )}
          {!turnoEnPasado && !reserva.cancelada && (
            <a
              href={`/reservar/cancelar/${reserva.codigo}`}
              class="rounded-full border px-3 py-1.5 transition-colors"
              style="border-color: rgba(122,61,46,0.32); color: var(--color-clay);"
            >
              Cancelar
            </a>
          )}
        </div>
      </div>
      {reserva.cancelada && (
        <p class="mt-3 text-[12px] text-[var(--color-muted)]">
          Cancelada · {reserva.cancelada.motivo}
        </p>
      )}
    </li>
  );
}