/** @jsxImportSource preact */
import { useEffect, useMemo, useState } from "preact/hooks";
import type { JSX } from "preact";
import {
  cargarReservas,
  guardarReservas,
  slotsOcupados,
  validarSlotLibre,
} from "../../lib/reservas";
import {
  profesionalPorId,
  servicioPorId,
  servicios,
  profesionales,
} from "../../data/servicios";
import type {
  Profesional,
  ProfesionalId,
  Reserva,
  Servicio,
  ServicioId,
} from "../../lib/types";
import {
  addMinutes,
  capServicioParaFecha,
  cmpHHMM,
  formatFechaLarga,
  formatHora,
  formatPrecio,
  fromIsoDate,
  generarSlots,
  horaAperturaParaFecha,
  horaCierreParaFecha,
  isoWeekday,
  MESES,
  toIsoDate,
} from "../../lib/horarios";
import {
  agregadosPorEstilistas,
  type RatingAggregate,
} from "../../lib/ratings";
import { RatingStarsDisplay } from "../booking/RatingStars";

interface Props {
  codigo: string;
}

type State =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "found"; reserva: Reserva };

type Step = "servicio" | "profesional" | "fecha" | "hora" | "revisar";

const RESCHEDULE_THRESHOLD_MS = 2 * 60 * 60 * 1000;
const MAX_RESERVAS_POR_PROFESIONAL_DIA = 3;

export default function ModifyBookingIsland({ codigo }: Props): JSX.Element {
  const [state, setState] = useState<State>({ status: "loading" });
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const reservas = cargarReservas();
    const found = reservas.find((r) => r.codigo === codigo);
    setState(found ? { status: "found", reserva: found } : { status: "missing" });
  }, [codigo, refreshTick]);

  if (state.status === "loading") return <Skeleton />;
  if (state.status === "missing") return <Missing codigo={codigo} />;

  return <ModifyFlow codigo={codigo} initial={state.reserva} onDone={() => setRefreshTick((n) => n + 1)} />;
}

function Skeleton(): JSX.Element {
  return (
    <div class="bezel-shell">
      <div class="bezel-core p-6 sm:p-10" aria-busy="true" aria-live="polite">
        <div class="h-6 w-40 rounded-full bg-[rgba(31,24,18,0.06)]" />
        <div class="mt-6 h-12 w-3/4 rounded-2xl bg-[rgba(31,24,18,0.06)]" />
      </div>
    </div>
  );
}

function Missing({ codigo }: { codigo: string }): JSX.Element {
  return (
    <div class="bezel-shell">
      <div class="bezel-core p-6 sm:p-10">
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Sin resultados
        </p>
        <h1 class="display-italic mt-3 font-serif text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.05] text-[var(--color-ink)]">
          No encontramos la reserva <em>{codigo}</em>.
        </h1>
        <p class="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          Verificá el código. Es posible que la reserva se haya cancelado o que
          se haya hecho desde otro navegador.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <a href="/reservar" class="btn-pill btn-primary">
            <span>Hacer una reserva nueva</span>
          </a>
          <a href="/" class="btn-pill btn-ghost">
            <span>Volver al inicio</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function ModifyFlow({
  codigo,
  initial,
  onDone,
}: {
  codigo: string;
  initial: Reserva;
  onDone: () => void;
}): JSX.Element {
  const [step, setStep] = useState<Step>("fecha");
  const [servicioIds, setServicioIds] = useState<ServicioId[]>(
    initial.servicioIds && initial.servicioIds.length ? initial.servicioIds : [initial.servicioId],
  );
  const [profesionalId, setProfesionalId] = useState<ProfesionalId | "cualquiera">(
    initial.profesionalId,
  );
  const [fecha, setFecha] = useState<string>(initial.fecha);
  const [hora, setHora] = useState<string>(initial.hora);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [aggregates, setAggregates] = useState<Record<string, RatingAggregate>>({});

  useEffect(() => {
    setReservas(cargarReservas());
    setHydrated(true);
    const allProfesionales = profesionales;
    setAggregates(agregadosPorEstilistas(allProfesionales.map((p) => p.id)));
  }, []);

  // Impedir reagendar si el turno está dentro de las 2h o ya pasó.
  const [hh, mm] = initial.hora.split(":").map(Number);
  const initialFecha = fromIsoDate(initial.fecha);
  initialFecha.setHours(hh ?? 0, mm ?? 0, 0, 0);
  const msHastaTurno = initialFecha.getTime() - Date.now();
  const turnoBloqueado = msHastaTurno <= RESCHEDULE_THRESHOLD_MS;

  const servicioPrincipal: Servicio | undefined = servicioIds[0]
    ? servicioPorId(servicioIds[0])
    : undefined;

  const duracionTotalMin = useMemo(() => {
    return servicioIds.reduce((acc, id) => acc + (servicioPorId(id)?.duracionMin ?? 0), 0);
  }, [servicioIds]);

  const slots: string[] = useMemo(() => {
    if (!duracionTotalMin) return [];
    const inicio = horaAperturaParaFecha(fecha);
    const fin = horaCierreParaFecha(fecha);
    if (inicio === 0 || fin === 0) return [];
    const cap = capServicioParaFecha(fecha);
    return generarSlots(inicio, fin, 30).filter((s) => {
      return cmpHHMM(addMinutes(s, duracionTotalMin), cap) <= 0;
    });
  }, [fecha, duracionTotalMin]);

  const ocupados: Set<string> = useMemo(() => {
    // Excluir la propia reserva para no chocar con nosotros mismos.
    const sinMias = reservas.filter((r) => r.codigo !== codigo);
    return slotsOcupados(sinMias, fecha, profesionalId);
  }, [reservas, fecha, profesionalId, codigo]);

  const disponibles = slots.filter((s) => !ocupados.has(s));

  if (turnoBloqueado) {
    return (
      <div class="bezel-shell">
        <div class="bezel-core p-6 sm:p-10">
          <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
            Modificar reserva
          </p>
          <h1 class="display-italic mt-3 font-serif text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.05] text-[var(--color-ink)]">
            No se puede <em>reagendar</em> este turno.
          </h1>
          <p class="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
            {msHastaTurno <= 0
              ? "Tu turno ya pasó. Si querés cambiar la hora, hacé una reserva nueva."
              : "Faltan menos de dos horas para tu turno. Para cambios de último momento, llamanos por teléfono."}
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <a href={`/reservar/${codigo}`} class="btn-pill btn-primary">
              <span>Volver al comprobante</span>
            </a>
            <a href="/reservar" class="btn-pill btn-ghost">
              <span>Hacer una reserva nueva</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = () => {
    if (!servicioPrincipal || !fecha || !hora || submitting) return;
    setSubmitting(true);

    const validacion = validarSlotLibre(
      reservas.filter((r) => r.codigo !== codigo),
      {
        fecha,
        hora,
        duracionTotalMin,
        profesionalId,
        servicioId: servicioPrincipal.id,
        servicioIds,
      },
    );
    if (!validacion.ok) {
      // eslint-disable-next-line no-alert
      alert(validacion.motivo);
      setSubmitting(false);
      return;
    }
    const updated: Reserva = {
      ...initial,
      servicioId: servicioPrincipal.id,
      servicioIds,
      profesionalId,
      fecha,
      hora,
      duracionMin: servicioPrincipal.duracionMin,
      duracionTotalMin,
    };
    const nuevas = reservas.map((r) => (r.codigo === codigo ? updated : r));
    guardarReservas(nuevas);
    setReservas(nuevas);
    setSubmitting(false);
    setDone(true);
    onDone();
    if (typeof window !== "undefined") {
      // Pequeño delay para que el usuario vea el estado final.
      window.setTimeout(() => {
        window.location.href = `/reservar/${codigo}`;
      }, 600);
    }
  };

  if (done) {
    return (
      <div class="bezel-shell">
        <div class="bezel-core p-6 sm:p-10">
          <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
            Listo
          </p>
          <h1 class="display-italic mt-3 font-serif text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.05] text-[var(--color-ink)]">
            Tu reserva <em>fue actualizada</em>.
          </h1>
          <p class="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
            Te llevamos al comprobante para que veas el cambio.
          </p>
        </div>
      </div>
    );
  }

  const profesionalLabel =
    profesionalId === "cualquiera"
      ? "Cualquiera disponible"
      : profesionalPorId(profesionalId)?.nombre ?? "";
  const precioTotal = servicioIds.reduce((acc, id) => acc + (servicioPorId(id)?.precio ?? 0), 0);

  return (
    <div class="bezel-shell">
      <div class="bezel-core p-6 sm:p-8 lg:p-10">
        <header>
          <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
            Modificar reserva
          </p>
          <h1 class="display-italic mt-3 font-serif text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.05] text-[var(--color-ink)]">
            Cambiá <em>lo que necesites</em>.
          </h1>
          <p class="mt-3 max-w-[60ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
            Mantenemos el mismo código ({codigo}). Si querés solo cambiar fecha y
            hora, andá directo al paso 1; si querés cambiar servicios, usá los
            pasos siguientes.
          </p>
        </header>

        <ol class="mt-8 flex flex-wrap items-center gap-x-2 gap-y-2 text-[12px]">
          {(
            [
              { id: "servicio", label: "Servicios" },
              { id: "profesional", label: "Profesional" },
              { id: "fecha", label: "Fecha" },
              { id: "hora", label: "Hora" },
              { id: "revisar", label: "Revisar" },
            ] as const
          ).map((s, i, arr) => {
            const reached =
              arr.findIndex((x) => x.id === step) >= i;
            return (
              <li class="flex items-center gap-2" key={s.id}>
                <span
                  class="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-mono tabular-nums"
                  style={{
                    background: reached ? "var(--color-clay)" : "rgba(31,24,18,0.08)",
                    color: reached ? "var(--color-paper-2)" : "var(--color-ink-2)",
                  }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span
                  class="font-medium"
                  style={{
                    color: reached ? "var(--color-ink)" : "var(--color-muted)",
                  }}
                >
                  {s.label}
                </span>
                {i < arr.length - 1 && (
                  <span class="mx-1 h-px w-4 bg-[rgba(31,24,18,0.18)]" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ol>

        <div class="mt-8">
          {step === "servicio" && (
            <ServicioEditStep
              servicioIds={servicioIds}
              onChange={(ids) => {
                setServicioIds(ids);
                setHora(null);
              }}
            />
          )}

          {step === "profesional" && servicioPrincipal && (
            <ProfesionalEditStep
              value={profesionalId}
              aggregates={aggregates}
              onChange={setProfesionalId}
            />
          )}

          {step === "fecha" && servicioPrincipal && (
            <FechaEditStep
              profesionales={profesionales}
              reservas={reservas}
              excludeCodigo={codigo}
              value={fecha}
              onChange={(d) => {
                setFecha(d);
                setHora(null);
              }}
            />
          )}

          {step === "hora" && servicioPrincipal && (
            <HoraEditStep
              slots={slots}
              disponibles={disponibles}
              ocupados={ocupados}
              value={hora}
              onChange={setHora}
            />
          )}

          {step === "revisar" && servicioPrincipal && (
            <RevisarStep
              servicioPrincipal={servicioPrincipal}
              servicioIds={servicioIds}
              profesionalLabel={profesionalLabel}
              fecha={fecha}
              hora={hora}
              duracionTotalMin={duracionTotalMin}
              precioTotal={precioTotal}
              submitting={submitting}
              onSubmit={handleSubmit}
            />
          )}
        </div>

        <div class="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(31,24,18,0.08)] pt-6">
          <button
            type="button"
            class="btn-pill btn-ghost"
            onClick={() => {
              if (step === "servicio") {
                if (typeof window !== "undefined") window.history.back();
              } else {
                const order: Step[] = ["servicio", "profesional", "fecha", "hora", "revisar"];
                const idx = order.indexOf(step);
                if (idx > 0) setStep(order[idx - 1]!);
              }
            }}
            disabled={step === "fecha"}
          >
            <span>Volver</span>
          </button>
          {step !== "revisar" ? (
            <button
              type="button"
              class="btn-pill btn-primary"
              onClick={() => {
                const order: Step[] = ["servicio", "profesional", "fecha", "hora", "revisar"];
                const idx = order.indexOf(step);
                if (idx >= 0 && idx < order.length - 1) setStep(order[idx + 1]!);
              }}
              disabled={
                (step === "servicio" && servicioIds.length === 0) ||
                (step === "fecha" && !fecha) ||
                (step === "hora" && !hora)
              }
              style={{
                opacity:
                  (step === "servicio" && servicioIds.length === 0) ||
                  (step === "fecha" && !fecha) ||
                  (step === "hora" && !hora)
                    ? 0.5
                    : 1,
                pointerEvents:
                  (step === "servicio" && servicioIds.length === 0) ||
                  (step === "fecha" && !fecha) ||
                  (step === "hora" && !hora)
                    ? "none"
                    : "auto",
              }}
            >
              <span>Continuar</span>
              <span class="icon-bubble !h-5 !w-5" aria-hidden="true">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
            </button>
          ) : (
            <button
              type="button"
              class="btn-pill btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
              aria-busy={submitting}
            >
              <span>{submitting ? "Guardando…" : "Guardar cambios"}</span>
              <span class="icon-bubble !h-5 !w-5" aria-hidden="true">
                {submitting ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-dasharray="6 6" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                )}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ServicioEditStep({
  servicioIds,
  onChange,
}: {
  servicioIds: ServicioId[];
  onChange: (ids: ServicioId[]) => void;
}): JSX.Element {
  return (
    <div>
      <header>
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Paso 1 · Servicios
        </p>
        <h2 class="mt-2 font-serif text-[24px] leading-[1.1] text-[var(--color-ink)]">
          ¿Cambiamos el servicio?
        </h2>
        <p class="mt-3 max-w-[52ch] text-[14px] leading-relaxed text-[var(--color-ink-2)]">
          Si está bien como está, seguí con Continuar. Si querés sumar o cambiar,
          elegí los servicios.
        </p>
      </header>

      <ul class="mt-6 grid gap-3 sm:grid-cols-2">
        {servicios.map((s) => {
          const active = servicioIds.includes(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                class="w-full rounded-[var(--radius-card)] p-4 text-left transition-all"
                style={{
                  background: active ? "var(--color-clay)" : "var(--color-paper-3)",
                  color: active ? "var(--color-paper-2)" : "var(--color-ink)",
                  border: `1px solid ${active ? "var(--color-clay)" : "rgba(31,24,18,0.08)"}`,
                }}
                onClick={() => {
                  if (servicioIds[0] === s.id) {
                    onChange(servicioIds.filter((x) => x !== s.id));
                  } else if (servicioIds.includes(s.id)) {
                    onChange(servicioIds.filter((x) => x !== s.id));
                  } else {
                    onChange([s.id, ...servicioIds.filter((x) => x !== servicioIds[0])]);
                  }
                }}
                aria-pressed={active}
              >
                <div class="flex items-baseline justify-between gap-3">
                  <span class="font-serif text-[16px] leading-tight">{s.nombre}</span>
                  <span class="font-mono text-[11px] tabular-nums">{formatPrecio(s.precio)}</span>
                </div>
                <p class="mt-1 text-[12px] opacity-80">{s.duracionMin} min</p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ProfesionalEditStep({
  value,
  aggregates,
  onChange,
}: {
  value: ProfesionalId | "cualquiera";
  aggregates: Record<string, RatingAggregate>;
  onChange: (v: ProfesionalId | "cualquiera") => void;
}): JSX.Element {
  const all = profesionales;
  return (
    <div>
      <header>
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Paso 2 · Profesional
        </p>
        <h2 class="mt-2 font-serif text-[24px] leading-[1.1] text-[var(--color-ink)]">
          ¿Con quién te atendés?
        </h2>
      </header>
      <ul class="mt-6 grid gap-3 sm:grid-cols-2">
        {(["cualquiera", ...all.map((p) => p.id)] as (ProfesionalId | "cualquiera")[]).map((id) => {
          const isCualquiera = id === "cualquiera";
          const prof = isCualquiera ? null : all.find((p) => p.id === id);
          const agg = prof ? aggregates[prof.id] : null;
          const selected = value === id;
          return (
            <li key={id}>
              <button
                type="button"
                class="w-full rounded-[var(--radius-card)] p-4 text-left transition-all"
                style={{
                  background: selected ? "var(--color-clay)" : "var(--color-paper-3)",
                  color: selected ? "var(--color-paper-2)" : "var(--color-ink)",
                  border: `1px solid ${selected ? "var(--color-clay)" : "rgba(31,24,18,0.08)"}`,
                }}
                onClick={() => onChange(id)}
                aria-pressed={selected}
              >
                <p class="font-serif text-[16px]">
                  {isCualquiera ? "Cualquiera disponible" : prof?.nombre}
                </p>
                {!isCualquiera && agg && (
                  <div class="mt-2">
                    <RatingStarsDisplay
                      promedio={agg.promedio}
                      count={agg.count}
                      size="sm"
                    />
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FechaEditStep({
  profesionales: all,
  reservas,
  excludeCodigo,
  value,
  onChange,
}: {
  profesionales: Profesional[];
  reservas: Reserva[];
  excludeCodigo: string;
  value: string;
  onChange: (d: string) => void;
}): JSX.Element {
  const [cursor, setCursor] = useState<{ y: number; m: number }>(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return { y: t.getFullYear(), m: t.getMonth() };
  });
  const t = new Date();
  t.setHours(0, 0, 0, 0);

  const firstWd = (() => {
    const d = new Date(cursor.y, cursor.m, 1);
    return (d.getDay() + 6) % 7;
  })();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();

  const cells: { date: Date | null; iso: string | null }[] = [];
  for (let i = 0; i < firstWd; i++) cells.push({ date: null, iso: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(cursor.y, cursor.m, d);
    cells.push({ date: dt, iso: toIsoDate(dt) });
  }
  const canGoPrev =
    new Date(cursor.y, cursor.m - 1, 1).getTime() >=
    new Date(t.getFullYear(), t.getMonth(), 1).getTime();

  const isToday = (iso: string): boolean => iso === toIsoDate(t);

  return (
    <div>
      <header>
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Paso 3 · Fecha
        </p>
        <h2 class="mt-2 font-serif text-[24px] leading-[1.1] text-[var(--color-ink)]">
          Elegí el nuevo día
        </h2>
        <p class="mt-2 text-[14px] text-[var(--color-ink-2)]">
          Mantenés tu código ({excludeCodigo}) en cualquiera de las opciones.
        </p>
      </header>

      <div class="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-[rgba(31,24,18,0.08)]">
        <div
          class="flex items-center justify-between px-4 py-3 sm:px-6"
          style="background: var(--color-paper-3);"
        >
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-300 disabled:opacity-30"
            style="background: rgba(31,24,18,0.06); color: var(--color-ink);"
            onClick={() => {
              if (!canGoPrev) return;
              setCursor((c) => {
                const m = c.m - 1;
                return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m };
              });
            }}
            disabled={!canGoPrev}
            aria-label="Mes anterior"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 2 4 6l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <span class="font-serif text-[16px] capitalize text-[var(--color-ink)]">
            {MESES[cursor.m]} {cursor.y}
          </span>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-300"
            style="background: rgba(31,24,18,0.06); color: var(--color-ink);"
            onClick={() =>
              setCursor((c) => {
                const m = c.m + 1;
                return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m };
              })
            }
            aria-label="Mes siguiente"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 2 8 6l-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <div class="px-4 pb-5 sm:px-6">
          <div class="grid grid-cols-7 gap-1.5 text-center font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
            {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
              <span key={d} class="py-2">{d}</span>
            ))}
          </div>
          <div class="grid grid-cols-7 gap-1.5">
            {cells.map((cell, idx) => {
              if (!cell.date || !cell.iso) {
                return <span key={idx} class="aspect-square" aria-hidden="true" />;
              }
              const inPast = fromIsoDate(cell.iso).getTime() < t.getTime();
              const wd = isoWeekday(cell.date);
              const isSunday = wd === 7;
              const isWorking = all.some((p) => p.diasTrabajo.includes(wd));
              const today = isToday(cell.iso);
              const disabled = inPast || isSunday || !isWorking;
              const selected = value === cell.iso;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  class="aspect-square rounded-[10px] text-[14px] tabular-nums transition-all duration-300"
                  style={{
                    background: selected
                      ? "var(--color-clay)"
                      : today
                      ? "var(--color-paper-3)"
                      : "transparent",
                    color: selected
                      ? "var(--color-paper-2)"
                      : disabled
                      ? "rgba(31,24,18,0.28)"
                      : "var(--color-ink)",
                    border: selected
                      ? "1px solid var(--color-clay)"
                      : today
                      ? "1px solid var(--color-clay)"
                      : "1px solid rgba(31,24,18,0.1)",
                    cursor: disabled ? "not-allowed" : "pointer",
                    fontWeight: today ? 600 : 400,
                  }}
                  onClick={() => !disabled && onChange(cell.iso!)}
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={`${formatFechaLarga(cell.iso)}${today ? ", hoy" : ""}${disabled ? ", no disponible" : ""}`}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function HoraEditStep({
  slots,
  disponibles,
  ocupados,
  value,
  onChange,
}: {
  slots: string[];
  disponibles: string[];
  ocupados: Set<string>;
  value: string;
  onChange: (s: string) => void;
}): JSX.Element {
  const isEmpty = disponibles.length === 0;
  return (
    <div>
      <header>
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Paso 4 · Hora
        </p>
        <h2 class="mt-2 font-serif text-[24px] leading-[1.1] text-[var(--color-ink)]">
          Nuevo horario
        </h2>
        <p class="mt-3 max-w-[52ch] text-[14px] leading-relaxed text-[var(--color-ink-2)]">
          {isEmpty
            ? "No quedan horarios libres para este servicio en esa fecha. Volvé y probá con otro día."
            : "Elegí un horario disponible para tu nuevo turno."}
        </p>
      </header>
      {isEmpty ? (
        <div
          class="mt-6 flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[rgba(31,24,18,0.18)] p-8 text-center"
          style="background: var(--color-paper-3);"
        >
          <p class="font-serif text-[18px] text-[var(--color-ink)]">Sin horarios libres</p>
          <p class="text-[13px] text-[var(--color-ink-2)]">Probá con otra fecha.</p>
        </div>
      ) : (
        <div class="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4 md:gap-3">
          {slots.map((s) => {
            const busy = ocupados.has(s);
            const selected = value === s;
            return (
              <button
                key={s}
                type="button"
                disabled={busy}
                class={`slot ${selected ? "slot-selected" : ""} ${busy ? "slot-busy" : ""}`}
                onClick={() => !busy && onChange(s)}
                aria-pressed={selected}
                aria-label={`${formatHora(s)}${busy ? ", ocupado" : ", disponible"}`}
              >
                {formatHora(s)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RevisarStep({
  servicioPrincipal,
  servicioIds,
  profesionalLabel,
  fecha,
  hora,
  duracionTotalMin,
  precioTotal,
  submitting,
  onSubmit,
}: {
  servicioPrincipal: Servicio;
  servicioIds: ServicioId[];
  profesionalLabel: string;
  fecha: string;
  hora: string;
  duracionTotalMin: number;
  precioTotal: number;
  submitting: boolean;
  onSubmit: () => void;
}): JSX.Element {
  return (
    <div>
      <header>
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Paso 5 · Revisar
        </p>
        <h2 class="mt-2 font-serif text-[24px] leading-[1.1] text-[var(--color-ink)]">
          Revisá y confirmá
        </h2>
      </header>
      <div
        class="mt-6 rounded-[var(--radius-input)] border border-[rgba(31,24,18,0.08)] p-5"
        style="background: var(--color-paper-3);"
      >
        <dl class="grid gap-1.5 text-[14.5px] text-[var(--color-ink)]">
          <div class="flex justify-between gap-3">
            <dt class="text-[var(--color-ink-2)]">Servicios</dt>
            <dd class="text-right">
              {servicioIds.map((id) => servicioPorId(id)?.nombre).filter(Boolean).join(" + ")}
            </dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-[var(--color-ink-2)]">Profesional</dt>
            <dd class="text-right">{profesionalLabel}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-[var(--color-ink-2)]">Fecha</dt>
            <dd class="text-right">{formatFechaLarga(fecha)}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-[var(--color-ink-2)]">Hora</dt>
            <dd class="text-right font-mono tabular-nums">
              {formatHora(hora)} - {formatHora(addMinutes(hora, duracionTotalMin))}
            </dd>
          </div>
          <div class="flex justify-between gap-3 border-t border-[rgba(31,24,18,0.08)] pt-2 mt-1">
            <dt class="text-[var(--color-ink-2)]">Precio</dt>
            <dd class="text-right font-mono tabular-nums">{formatPrecio(precioTotal)}</dd>
          </div>
        </dl>
      </div>
      <button
        type="button"
        class="btn-pill btn-primary mt-6"
        onClick={onSubmit}
        disabled={submitting}
        aria-busy={submitting}
      >
        <span>{submitting ? "Guardando…" : "Confirmar cambios"}</span>
        <span class="icon-bubble !h-5 !w-5" aria-hidden="true">
          {submitting ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-dasharray="6 6" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          )}
        </span>
      </button>
    </div>
  );
}