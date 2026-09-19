/** @jsxImportSource preact */
import { useEffect, useMemo, useState } from "preact/hooks";
import type { JSX } from "preact";
import {
  agregarReserva,
  agruparPorFecha,
  cargarReservas,
  eliminarReservaPorCodigo,
  guardarReservas,
} from "../../lib/reservas";
import { profesionalPorId, servicioPorId } from "../../data/servicios";
import type { Reserva, ReservaInput } from "../../lib/types";
import {
  addMinutes,
  formatFechaLarga,
  formatHora,
  formatPrecio,
  fromIsoDate,
  generarCodigoReserva,
  isoWeekday,
  toIsoDate,
} from "../../lib/horarios";
import { DIAS_SEMANA, MESES } from "../../lib/horarios";

const ADMIN_KEY = "aurora.admin.session.v1";
const PIN_KEY = "aurora.admin.pin.v1";
const DEFAULT_PIN = "1234";

const isBrowser = (): boolean => typeof window !== "undefined";

const ensurePin = (): string => {
  if (!isBrowser()) return DEFAULT_PIN;
  const stored = window.localStorage.getItem(PIN_KEY);
  if (!stored) {
    window.localStorage.setItem(PIN_KEY, DEFAULT_PIN);
    return DEFAULT_PIN;
  }
  return stored;
};

const isAuthed = (): boolean => {
  if (!isBrowser()) return false;
  return window.localStorage.getItem(ADMIN_KEY) === "ok";
};

const auth = (): void => {
  if (!isBrowser()) return;
  window.localStorage.setItem(ADMIN_KEY, "ok");
};

const logout = (): void => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ADMIN_KEY);
};

export default function AdminPanel(): JSX.Element {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [filter, setFilter] = useState<"todas" | "proximas" | "pasadas">("todas");

  useEffect(() => {
    ensurePin();
    setAuthed(isAuthed());
    setReservas(cargarReservas());
    setHydrated(true);
  }, []);

  const onPinSubmit = (e: Event) => {
    e.preventDefault();
    const real = ensurePin();
    if (pin === real) {
      auth();
      setAuthed(true);
      setError(null);
      setPin("");
    } else {
      setError("PIN incorrecto.");
    }
  };

  const handleLogout = () => {
    logout();
    setAuthed(false);
  };

  const handleEliminar = (codigo: string) => {
    const next = eliminarReservaPorCodigo(codigo);
    setReservas(next);
  };

  const handleSeedDemo = () => {
    // Generate one demo reservation in the past, one today, one tomorrow.
    const servicios = ["corte-dama", "coloracion", "keratina"];
    const profesionales = ["lucia", "carlos", "camila"] as const;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 3);
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);

    const seedFor = (date: Date, hora: string, idx: number): Reserva => {
      const sid = servicios[idx % servicios.length] ?? "corte-dama";
      const pid = profesionales[idx % profesionales.length] ?? "cualquiera";
      const duracion = servicioPorId(sid as Parameters<typeof servicioPorId>[0])?.duracionMin ?? 60;
      const reserva: Reserva = {
        codigo: generarCodigoReserva(),
        servicioId: sid as Reserva["servicioId"],
        servicioIds: [sid as Reserva["servicioId"]],
        profesionalId: pid,
        fecha: toIsoDate(date),
        hora,
        duracionMin: duracion,
        duracionTotalMin: duracion,
        cliente: {
          nombre: ["Mariana Vázquez", "Sofía Romero", "Pedro Linares"][idx % 3] ?? "Cliente demo",
          telefono: `+54 9 11 5555-000${idx + 1}`,
          email: `cliente${idx + 1}@demo.local`,
          notas: idx === 0 ? "Alergia a la keratina. Prefiere sin amoníaco." : undefined,
        },
        creadaEn: new Date().toISOString(),
      };
      return reserva;
    };
    const seeds = [
      seedFor(ayer, "10:00", 0),
      seedFor(hoy, "16:30", 1),
      seedFor(manana, "11:00", 2),
    ];
    const actuales = cargarReservas();
    guardarReservas([...actuales, ...seeds]);
    setReservas(cargarReservas());
  };

  const handleBorrarTodo = () => {
    if (!confirm("¿Borrar TODAS las reservas guardadas? Esta acción no se puede deshacer.")) return;
    guardarReservas([]);
    setReservas([]);
  };

  const reservasFiltradas = useMemo(() => {
    if (filter === "todas") return reservas;
    const ahora = Date.now();
    return reservas.filter((r) => {
      const [hh, mm] = r.hora.split(":").map(Number);
      const f = fromIsoDate(r.fecha);
      f.setHours(hh ?? 0, mm ?? 0, 0, 0);
      const fin = f.getTime() + (r.duracionTotalMin || r.duracionMin) * 60_000;
      return filter === "pasadas" ? fin < ahora : fin >= ahora;
    });
  }, [reservas, filter]);

  const agrupadas = useMemo(() => agruparPorFecha(reservasFiltradas), [reservasFiltradas]);

  if (!hydrated) {
    return (
      <div class="bezel-shell">
        <div class="bezel-core p-6 sm:p-10" aria-busy="true" aria-live="polite">
          <div class="h-6 w-32 rounded-full bg-[rgba(31,24,18,0.06)]" />
          <div class="mt-6 h-12 w-3/4 rounded-2xl bg-[rgba(31,24,18,0.06)]" />
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <form onSubmit={onPinSubmit} class="bezel-shell">
        <div class="bezel-core p-6 sm:p-10">
          <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
            Acceso restringido
          </p>
          <h1 class="display-italic mt-3 font-serif text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.05] text-[var(--color-ink)]">
            Panel <em>administración</em>
          </h1>
          <p class="mt-4 max-w-[44ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
            Esta vista es solo para dueñas y staff. Ingresá el PIN para ver la
            agenda completa.
          </p>
          <div class="mt-6 max-w-xs">
            <label
              class="block text-[13px] font-medium text-[var(--color-ink)]"
              for="admin-pin"
            >
              PIN
            </label>
            <input
              id="admin-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onInput={(e) => setPin((e.currentTarget as HTMLInputElement).value)}
              class={`field mt-1.5 ${error ? "field-error" : ""}`}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "pin-error" : "pin-hint"}
              autoFocus
            />
            {error ? (
              <p id="pin-error" class="mt-1.5 text-[12px] text-[var(--color-clay)]">
                {error}
              </p>
            ) : (
              <p id="pin-hint" class="mt-1.5 text-[12px] text-[var(--color-muted)]">
                PIN por defecto: <span class="font-mono tabular-nums">1234</span>.
                Cambialo desde la consola del navegador si querés.
              </p>
            )}
          </div>
          <div class="mt-6">
            <button type="submit" class="btn-pill btn-primary">
              <span>Ingresar</span>
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div class="grid gap-6">
      <header class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
            Administración
          </p>
          <h2 class="mt-2 font-serif text-[28px] leading-[1.1] text-[var(--color-ink)]">
            Agenda completa
          </h2>
          <p class="mt-2 text-[14px] text-[var(--color-ink-2)]">
            {reservas.length} reserva{reservas.length === 1 ? "" : "s"} guardada{reservas.length === 1 ? "" : "s"} en este navegador.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn-pill btn-ghost !py-2 !px-4 text-[13px]"
            onClick={handleSeedDemo}
            title="Sembrar tres reservas demo (ayer, hoy, mañana)"
          >
            <span>Sembrar demo</span>
          </button>
          <button
            type="button"
            class="btn-pill btn-ghost !py-2 !px-4 text-[13px]"
            onClick={handleBorrarTodo}
            title="Borrar TODAS las reservas"
          >
            <span>Borrar todo</span>
          </button>
          <button
            type="button"
            class="btn-pill btn-ghost !py-2 !px-4 text-[13px]"
            onClick={handleLogout}
          >
            <span>Cerrar sesión</span>
          </button>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Filtro"
        class="inline-flex self-start rounded-full p-1"
        style="background: var(--color-paper-3);"
      >
        {(
          [
            { id: "todas", label: "Todas" },
            { id: "proximas", label: "Próximas" },
            { id: "pasadas", label: "Pasadas" },
          ] as const
        ).map((v) => {
          const active = filter === v.id;
          return (
            <button
              key={v.id}
              role="tab"
              aria-selected={active}
              type="button"
              class="rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={{
                background: active ? "var(--color-clay)" : "transparent",
                color: active ? "var(--color-paper-2)" : "var(--color-ink-2)",
              }}
              onClick={() => setFilter(v.id)}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {agrupadas.length === 0 ? (
        <div
          class="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[rgba(31,24,18,0.18)] p-10 text-center"
          style="background: var(--color-paper-3);"
        >
          <p class="font-serif text-[18px] text-[var(--color-ink)]">
            No hay reservas para mostrar.
          </p>
          <p class="text-[13px] text-[var(--color-muted)]">
            Sembrá tres reservas demo para ver cómo queda el panel.
          </p>
        </div>
      ) : (
        <div class="grid gap-8">
          {agrupadas.map((g) => {
            const fecha = fromIsoDate(g.fecha);
            const dow = DIAS_SEMANA[isoWeekday(fecha) - 1];
            return (
              <section
                key={g.fecha}
                class="overflow-hidden rounded-[var(--radius-card)] border border-[rgba(31,24,18,0.08)]"
              >
                <header
                  class="flex flex-wrap items-baseline justify-between gap-3 border-b border-[rgba(31,24,18,0.08)] px-5 py-3"
                  style="background: var(--color-paper-3);"
                >
                  <h3 class="font-serif text-[18px] text-[var(--color-ink)]">
                    {dow} {fecha.getDate()} de {MESES[fecha.getMonth()]}
                  </h3>
                  <span class="font-mono text-[11px] tabular-nums text-[var(--color-muted)]">
                    {g.items.length} turno{g.items.length === 1 ? "" : "s"}
                  </span>
                </header>
                <ul>
                  {g.items.map((r, idx) => (
                    <li
                      key={r.codigo}
                      class={`grid grid-cols-12 items-center gap-2 px-5 py-4 text-[14px] ${
                        idx > 0 ? "border-t border-[rgba(31,24,18,0.06)]" : ""
                      }`}
                      style="background: var(--color-paper-2);"
                    >
                      <div class="col-span-12 sm:col-span-2">
                        <p class="font-mono text-[14px] tabular-nums text-[var(--color-ink)]">
                          {formatHora(r.hora)}
                        </p>
                        <p class="text-[11px] text-[var(--color-muted)]">
                          {r.duracionTotalMin || r.duracionMin} min
                        </p>
                      </div>
                      <div class="col-span-12 sm:col-span-5">
                        <p class="font-medium text-[var(--color-ink)]">
                          {servicioPorId(r.servicioId)?.nombre ?? r.servicioId}
                        </p>
                        <p class="text-[12px] text-[var(--color-muted)]">
                          {r.servicioIds.slice(1).map((s) => servicioPorId(s)?.nombre).filter(Boolean).join(" + ")}
                        </p>
                      </div>
                      <div class="col-span-12 sm:col-span-3">
                        <p class="text-[13px] text-[var(--color-ink-2)]">
                          {r.cliente.nombre}
                        </p>
                        <p class="text-[11px] text-[var(--color-muted)]">
                          {profesionalPorId(r.profesionalId)?.nombre ?? "Cualquiera"}
                        </p>
                      </div>
                      <div class="col-span-12 flex flex-wrap gap-2 sm:col-span-2 sm:justify-end">
                        <a
                          href={`/reservar/${r.codigo}`}
                          class="rounded-full border border-[rgba(31,24,18,0.18)] px-3 py-1.5 text-[12px] transition-colors hover:border-[var(--color-clay)] hover:text-[var(--color-clay)]"
                        >
                          Ver
                        </a>
                        <a
                          href={`/reservar/modificar/${r.codigo}`}
                          class="rounded-full border border-[rgba(31,24,18,0.18)] px-3 py-1.5 text-[12px] transition-colors hover:border-[var(--color-clay)] hover:text-[var(--color-clay)]"
                        >
                          Editar
                        </a>
                        <button
                          type="button"
                          class="rounded-full border px-3 py-1.5 text-[12px] transition-colors"
                          style="border-color: rgba(122,61,46,0.32); color: var(--color-clay);"
                          onClick={() => {
                            if (confirm(`¿Eliminar la reserva ${r.codigo}?`)) {
                              handleEliminar(r.codigo);
                            }
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                      {r.cancelada && (
                        <p class="col-span-12 text-[12px] text-[var(--color-muted)]">
                          Cancelada · {r.cancelada.motivo}
                          {r.cancelada.nota ? ` · "${r.cancelada.nota}"` : ""}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}