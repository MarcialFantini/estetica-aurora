/** @jsxImportSource preact */
import { useEffect, useMemo, useState } from "preact/hooks";
import type { JSX } from "preact";
import { signal } from "@preact/signals";
import { servicios, profesionales, servicioPorId, serviciosEncadenables } from "../../data/servicios";
import type {
  Profesional,
  ProfesionalId,
  Reserva,
  Servicio,
  ServicioId,
} from "../../lib/types";
import {
  cargarReservas,
  contarReservasPorProfesionalEnFecha,
  guardarReservas,
  slotsOcupados,
  validarSlotLibre,
} from "../../lib/reservas";
import {
  addMinutes,
  capServicioParaFecha,
  cmpHHMM,
  formatFechaCorta,
  formatFechaLarga,
  formatHora,
  formatPrecio,
  fromIsoDate,
  generarCodigoReserva,
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
import { RatingStarsDisplay } from "./RatingStars";
import {
  cargarDraft,
  guardarDraft,
  limpiarDraft,
  type BookingDraft,
} from "../../lib/bookingDraft";

/** Saturation threshold per professional per day. */
const MAX_RESERVAS_POR_PROFESIONAL_DIA = 3;

/** Notes max length — keeps the receipt legible and localStorage tidy. */
const NOTAS_MAX = 400;

interface BookingIslandProps {
  prefProfesionalId?: string;
  prefServicioId?: string;
}

type Step = "servicio" | "profesional" | "fecha" | "hora" | "datos" | "confirmado";

/* ----------------------------------------------------------------------
 * Wizard state as shared signals.
 *
 * The signals are exported so child components (e.g. Stepper) can read
 * them without prop drilling. The owning BookingIsland hydrates them
 * from the URL draft and persists them on every change.
 *
 * Sub-components that receive data via props still do — the migration is
 * incremental. The pattern is established with `currentStep` (which the
 * Stepper reads directly via .value) and the other state signals are
 * exposed for the same usage pattern as the wizard evolves.
 * --------------------------------------------------------------------- */
export const currentStep = signal<Step>("servicio");
export const servicioIdsSignal = signal<ServicioId[]>([]);
export const profesionalIdSignal = signal<ProfesionalId | "cualquiera">("cualquiera");
export const fechaSignal = signal<string | null>(null);
export const horaSignal = signal<string | null>(null);
export const clienteSignal = signal<BookingDraft["cliente"]>({
  nombre: "",
  telefono: "",
  email: "",
  notas: "",
});

export default function BookingIsland(props: BookingIslandProps): JSX.Element {
  // Local state that doesn't need to cross component boundaries.
  const [submitting, setSubmitting] = useState(false);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [aggregates, setAggregates] = useState<Record<string, RatingAggregate>>({});

  // Hydrate reservations + (optionally) restore a saved draft.
  useEffect(() => {
    setReservas(cargarReservas());
    setHydrated(true);
    setAggregates(agregadosPorEstilistas(profesionales.map((p) => p.id)));

    const draft = cargarDraft();
    if (draft) {
      // If the wizard opens with a query string, the query wins.
      const qServicio = props.prefServicioId as ServicioId | undefined;
      const qProfesional = props.prefProfesionalId as ProfesionalId | undefined;
      if (qServicio && servicioPorId(qServicio)) {
        servicioIdsSignal.value = [qServicio];
      } else if (draft.servicioIds.length) {
        servicioIdsSignal.value = draft.servicioIds;
      } else if (draft.servicioId) {
        servicioIdsSignal.value = [draft.servicioId];
      }
      if (qProfesional) {
        profesionalIdSignal.value = qProfesional;
      } else if (draft.profesionalId) {
        profesionalIdSignal.value = draft.profesionalId;
      }
      if (draft.fecha) fechaSignal.value = draft.fecha;
      if (draft.hora) horaSignal.value = draft.hora;
      clienteSignal.value = draft.cliente;
    } else if (props.prefServicioId && servicioPorId(props.prefServicioId as ServicioId)) {
      servicioIdsSignal.value = [props.prefServicioId as ServicioId];
    }
    if (props.prefProfesionalId) {
      profesionalIdSignal.value = props.prefProfesionalId as ProfesionalId;
    }
  }, []);

  // Persist the in-flight wizard on every meaningful change.
  // Reads from signals each tick so persistence tracks the wizard's true state.
  useEffect(() => {
    if (!hydrated) return;
    const sIds = servicioIdsSignal.value;
    guardarDraft({
      servicioId: sIds[0] ?? null,
      servicioIds: sIds,
      profesionalId: profesionalIdSignal.value,
      fecha: fechaSignal.value,
      hora: horaSignal.value,
      step: currentStep.value,
      cliente: clienteSignal.value,
      updatedAt: new Date().toISOString(),
    });
  }, [
    hydrated,
    servicioIdsSignal.value,
    profesionalIdSignal.value,
    fechaSignal.value,
    horaSignal.value,
    currentStep.value,
    clienteSignal.value,
  ]);

  const servicioIds = servicioIdsSignal.value;
  const profesionalId = profesionalIdSignal.value;
  const fecha = fechaSignal.value;
  const hora = horaSignal.value;
  const step = currentStep.value;

  const servicioPrincipal: Servicio | undefined = servicioIds[0]
    ? servicioPorId(servicioIds[0])
    : undefined;

  const duracionTotalMin = useMemo(() => {
    return servicioIds.reduce((acc, id) => acc + (servicioPorId(id)?.duracionMin ?? 0), 0);
  }, [servicioIds]);

  const encadenables = useMemo(() => {
    if (!servicioPrincipal) return [];
    return serviciosEncadenables(servicioPrincipal.id).filter(
      (s) => !servicioIds.includes(s.id),
    );
  }, [servicioPrincipal, servicioIds]);

  // Build slot list with per-day opening hours + service-end cap.
  const slots: string[] = useMemo(() => {
    if (!fecha || !duracionTotalMin) return [];
    const inicio = horaAperturaParaFecha(fecha);
    const fin = horaCierreParaFecha(fecha);
    if (inicio === 0 || fin === 0) return [];
    const cap = capServicioParaFecha(fecha);
    return generarSlots(inicio, fin, 30).filter((s) => {
      return cmpHHMM(addMinutes(s, duracionTotalMin), cap) <= 0;
    });
  }, [fecha, duracionTotalMin]);

  const ocupados: Set<string> = useMemo(() => {
    if (!fecha || !duracionTotalMin) return new Set();
    return slotsOcupados(reservas, fecha, profesionalId);
  }, [reservas, fecha, profesionalId, duracionTotalMin]);

  const onSubmit = (e: Event) => {
    e.preventDefault();
    if (!servicioPrincipal || !fecha || !hora || submitting) return;
    setSubmitting(true);

    const validacion = validarSlotLibre(reservas, {
      fecha,
      hora,
      duracionTotalMin,
      profesionalId,
      servicioId: servicioPrincipal.id,
      servicioIds,
    });
    if (!validacion.ok) {
      // eslint-disable-next-line no-alert
      alert(validacion.motivo);
      setSubmitting(false);
      return;
    }

    const reserva: Reserva = {
      codigo: generarCodigoReserva(),
      servicioId: servicioPrincipal.id,
      servicioIds,
      profesionalId,
      fecha,
      hora,
      duracionMin: servicioPrincipal.duracionMin,
      duracionTotalMin,
      cliente: {
        nombre: clienteSignal.value.nombre.trim(),
        telefono: clienteSignal.value.telefono.trim(),
        email: clienteSignal.value.email.trim(),
        notas: clienteSignal.value.notas.trim() || undefined,
      },
      creadaEn: new Date().toISOString(),
    };

    const nuevas = [...reservas, reserva];
    setReservas(nuevas);
    guardarReservas(nuevas);
    limpiarDraft();

    if (typeof window !== "undefined") {
      window.location.href = `/reservar/${reserva.codigo}`;
    }
  };

  const resetDraft = () => {
    servicioIdsSignal.value = [];
    profesionalIdSignal.value = "cualquiera";
    fechaSignal.value = null;
    horaSignal.value = null;
    currentStep.value = "servicio";
    clienteSignal.value = { nombre: "", telefono: "", email: "", notas: "" };
    limpiarDraft();
  };

  return (
    <div class="bezel-shell">
      <div class="bezel-core p-6 sm:p-8 lg:p-10">
        <Stepper />

        <div class="mt-10">
          {step === "servicio" && (
            <ServicioStep
              servicioIds={servicioIds}
              encadenables={encadenables}
              onChangePrincipal={(id) => {
                servicioIdsSignal.value = [id];
              }}
              onToggleChained={(id) => {
                const curr = servicioIdsSignal.value;
                servicioIdsSignal.value = curr.includes(id)
                  ? curr.filter((x) => x !== id)
                  : [...curr, id];
                horaSignal.value = null;
              }}
              onContinue={() => {
                currentStep.value = "profesional";
              }}
            />
          )}

          {step === "profesional" && servicioPrincipal && (
            <ProfesionalStep
              profesionales={profesionales}
              reservas={reservas}
              referenceFecha={fecha}
              aggregates={aggregates}
              value={profesionalId}
              onChange={(v) => {
                profesionalIdSignal.value = v;
              }}
              onBack={() => {
                currentStep.value = "servicio";
              }}
              onContinue={() => {
                currentStep.value = "fecha";
              }}
            />
          )}

          {step === "fecha" && servicioPrincipal && (
            <FechaStep
              profesionales={profesionales}
              reservas={reservas}
              profesionalesDisponibles={professionalsDisponiblesParaFecha(
                profesionales,
                fecha,
              )}
              value={fecha}
              onChange={(d) => {
                fechaSignal.value = d;
                horaSignal.value = null;
              }}
              onBack={() => {
                currentStep.value = "profesional";
              }}
              onContinue={() => {
                currentStep.value = "hora";
              }}
            />
          )}

          {step === "hora" && servicioPrincipal && fecha && (
            <HoraStep
              servicio={servicioPrincipal}
              duracionTotalMin={duracionTotalMin}
              fecha={fecha}
              slots={slots}
              ocupados={ocupados}
              value={hora}
              onChange={(s) => {
                horaSignal.value = s;
              }}
              onBack={() => {
                currentStep.value = "fecha";
              }}
              onContinue={() => {
                currentStep.value = "datos";
              }}
            />
          )}

          {step === "datos" && servicioPrincipal && fecha && hora && (
            <DatosStep
              servicio={servicioPrincipal}
              servicioIds={servicioIds.map((id) => servicioPorId(id)!).filter(Boolean)}
              profesionalId={profesionalId}
              fecha={fecha}
              hora={hora}
              duracionTotalMin={duracionTotalMin}
              cliente={clienteSignal.value}
              onChange={(next) => {
                clienteSignal.value = next;
              }}
              submitting={submitting}
              onBack={() => {
                currentStep.value = "hora";
              }}
              onSubmit={onSubmit}
              hydrated={hydrated}
              notasMax={NOTAS_MAX}
            />
          )}
        </div>

        {hydrated &&
          (servicioIds.length > 0 ||
            clienteSignal.value.nombre ||
            clienteSignal.value.email) && (
            <div class="mt-8 flex items-center justify-between gap-3 border-t border-[rgba(31,24,18,0.08)] pt-6">
              <p class="text-[12px] text-[var(--color-muted)]">
                Tu borrador se guarda automáticamente en este navegador.
              </p>
              <button
                type="button"
                class="text-[12px] text-[var(--color-clay)] underline-offset-2 hover:underline"
                onClick={resetDraft}
              >
                Empezar de nuevo
              </button>
            </div>
          )}
      </div>
    </div>
  );
}

/* ----------------------------- Stepper ----------------------------- */

const stepLabels: { id: Step; label: string }[] = [
  { id: "servicio", label: "Servicio" },
  { id: "profesional", label: "Profesional" },
  { id: "fecha", label: "Fecha" },
  { id: "hora", label: "Hora" },
  { id: "datos", label: "Tus datos" },
];

function Stepper(): JSX.Element {
  // Reads the wizard step directly from the shared signal — no prop drilling.
  // This is the canonical pattern for components that only need to mirror
  // part of the global wizard state.
  const step = currentStep.value;
  const currentIdx = stepLabels.findIndex((s) => s.id === step);
  return (
    <div>
      <ol class="flex flex-wrap items-center gap-x-2 gap-y-2 text-[12px]">
        {stepLabels.map((s, i) => {
          const reached = i <= currentIdx;
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
              {i < stepLabels.length - 1 && (
                <span class="mx-1 h-px w-4 bg-[rgba(31,24,18,0.18)]" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
      <div
        class="mt-3 h-1 w-full overflow-hidden rounded-full"
        style="background: rgba(31,24,18,0.08);"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={stepLabels.length}
        aria-valuenow={currentIdx + 1}
      >
        <div
          class="h-full rounded-full"
          style={{
            width: `${((currentIdx + 1) / stepLabels.length) * 100}%`,
            background: "var(--color-clay)",
            transition: "width 600ms var(--ease-fluid)",
          }}
        />
      </div>
    </div>
  );
}

/* -------------------------- Servicio step -------------------------- */

function ServicioStep({
  servicioIds,
  encadenables,
  onChangePrincipal,
  onToggleChained,
  onContinue,
}: {
  servicioIds: ServicioId[];
  encadenables: Servicio[];
  onChangePrincipal: (id: ServicioId) => void;
  onToggleChained: (id: ServicioId) => void;
  onContinue: () => void;
}): JSX.Element {
  const principal = servicioIds[0] ? servicioPorId(servicioIds[0]) : undefined;
  const chained = servicioIds.slice(1);

  return (
    <div>
      <header>
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Paso 1
        </p>
        <h2 class="mt-2 font-serif text-[28px] leading-[1.1] text-[var(--color-ink)] sm:text-[32px]">
          ¿Qué servicio necesitás?
        </h2>
        <p class="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          Elegí el servicio principal. Si querés sumarle otro (corte + color, por
          ejemplo) tildá las opciones que aparecen debajo.
        </p>
      </header>

      <ul class="mt-8 grid gap-3 sm:grid-cols-2">
        {servicios.map((s) => {
          const selected = servicioIds[0] === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                class="w-full rounded-[var(--radius-card)] p-5 text-left transition-all duration-500"
                style={{
                  background: selected
                    ? "var(--color-clay)"
                    : "var(--color-paper-3)",
                  color: selected ? "var(--color-paper-2)" : "var(--color-ink)",
                  border: selected
                    ? "1px solid var(--color-clay)"
                    : "1px solid rgba(31,24,18,0.08)",
                  boxShadow: selected ? "var(--shadow-press)" : "none",
                }}
                onClick={() => onChangePrincipal(s.id)}
                aria-pressed={selected}
              >
                <div class="flex items-baseline justify-between gap-3">
                  <span class="font-serif text-[19px] leading-[1.15]">{s.nombre}</span>
                  <span
                    class="font-mono text-[12px] tabular-nums"
                    style={{
                      color: selected
                        ? "var(--color-paper-2)"
                        : "var(--color-ink-2)",
                    }}
                  >
                    {formatPrecio(s.precio)}
                  </span>
                </div>
                <p
                  class="mt-2 text-[14px] leading-relaxed"
                  style={{
                    color: selected
                      ? "rgba(250,244,234,0.86)"
                      : "var(--color-ink-2)",
                  }}
                >
                  {s.descripcion}
                </p>
                <p
                  class="mt-4 inline-flex items-center gap-2 text-[12px] font-mono uppercase tracking-[0.18em]"
                  style={{
                    color: selected
                      ? "rgba(250,244,234,0.8)"
                      : "var(--color-muted)",
                  }}
                >
                  <span aria-hidden="true">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.25" />
                      <path d="M6 3.25V6L7.75 7.25" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
                    </svg>
                  </span>
                  {s.duracionMin} min
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      {principal && encadenables.length > 0 && (
        <section class="mt-8 rounded-[var(--radius-input)] border border-dashed border-[rgba(31,24,18,0.18)] p-5">
          <header class="flex items-baseline justify-between gap-3">
            <div>
              <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
                Combinar servicios
              </p>
              <h3 class="mt-2 font-serif text-[20px] leading-[1.15] text-[var(--color-ink)]">
                ¿Lo combinamos con algo más?
              </h3>
              <p class="mt-1 text-[13px] text-[var(--color-ink-2)]">
                Sumá un segundo servicio para {principal.nombre.toLowerCase()}. Misma
                profesional, sin volver a reservar.
              </p>
            </div>
          </header>
          <ul class="mt-4 grid gap-2 sm:grid-cols-2">
            {encadenables.map((s) => {
              const active = chained.includes(s.id);
              return (
                <li key={s.id}>
                  <label
                    class="flex w-full cursor-pointer items-start gap-3 rounded-[var(--radius-input)] p-3 text-left text-[14px] transition-all"
                    style={{
                      background: active
                        ? "var(--color-paper-3)"
                        : "transparent",
                      border: `1px solid ${
                        active
                          ? "var(--color-clay)"
                          : "rgba(31,24,18,0.12)"
                      }`,
                    }}
                  >
                    <input
                      type="checkbox"
                      class="mt-1 h-4 w-4 accent-[var(--color-clay)]"
                      checked={active}
                      onChange={() => onToggleChained(s.id)}
                    />
                    <span class="flex-1">
                      <span class="flex items-baseline justify-between gap-2">
                        <span class="font-medium text-[var(--color-ink)]">
                          {s.nombre}
                        </span>
                        <span class="font-mono tabular-nums text-[12px] text-[var(--color-ink-2)]">
                          +{formatPrecio(s.precio)}
                        </span>
                      </span>
                      <span class="mt-0.5 block text-[12px] text-[var(--color-muted)]">
                        {s.duracionMin} min
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {principal && chained.length > 0 && (
        <p class="mt-4 text-[12px] text-[var(--color-muted)]">
          Duración total estimada:{" "}
          <span class="font-mono tabular-nums text-[var(--color-ink)]">
            {principal.duracionMin + chained.reduce(
              (acc, id) => acc + (servicioPorId(id)?.duracionMin ?? 0),
              0,
            )}{" "}
            min
          </span>
          · Precio total{" "}
          <span class="font-mono tabular-nums text-[var(--color-ink)]">
            {formatPrecio(
              (principal?.precio ?? 0) +
                chained.reduce(
                  (acc, id) => acc + (servicioPorId(id)?.precio ?? 0),
                  0,
                ),
            )}
          </span>
        </p>
      )}

      <div class="mt-8 flex justify-end">
        <button
          type="button"
          class="btn-pill btn-primary"
          disabled={!principal}
          onClick={onContinue}
          style={{ opacity: principal ? 1 : 0.5, pointerEvents: principal ? "auto" : "none" }}
        >
          <span>Continuar</span>
          <span class="icon-bubble !h-5 !w-5" aria-hidden="true">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
}

/* ------------------------ Profesional step ------------------------ */

function ProfesionalStep({
  profesionales: all,
  reservas,
  referenceFecha,
  aggregates,
  value,
  onChange,
  onBack,
  onContinue,
}: {
  profesionales: Profesional[];
  reservas: Reserva[];
  referenceFecha: string | null;
  aggregates: Record<string, RatingAggregate>;
  value: ProfesionalId | "cualquiera";
  onChange: (v: ProfesionalId | "cualquiera") => void;
  onBack: () => void;
  onContinue: () => void;
}): JSX.Element {
  const refFecha = referenceFecha ?? toIsoDate(new Date());
  const saturados = new Set<string>();
  const libres: Profesional[] = [];
  for (const p of all) {
    const n = contarReservasPorProfesionalEnFecha(reservas, refFecha, p.id);
    if (n >= MAX_RESERVAS_POR_PROFESIONAL_DIA) saturados.add(p.id);
    else libres.push(p);
  }
  const allSaturated = libres.length === 0;
  const saturadosCount = saturados.size;

  return (
    <div>
      <header>
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Paso 2
        </p>
        <h2 class="mt-2 font-serif text-[28px] leading-[1.1] text-[var(--color-ink)] sm:text-[32px]">
          ¿Con quién te atendés?
        </h2>
        <p class="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          Si no tenés preferencia, dejá que asignemos a la primera profesional disponible.
        </p>
      </header>

      {allSaturated && (
        <p class="mt-6 rounded-[var(--radius-input)] border border-[rgba(122,61,46,0.25)] bg-[rgba(122,61,46,0.06)] px-4 py-3 text-[14px] text-[var(--color-clay)]">
          Para {referenceFecha ? "esa fecha" : "hoy"} todas las profesionales tienen la
          agenda llena. Elegí <em>Cualquiera disponible</em> para que te asignemos
          un reemplazo o cambiá el día.
        </p>
      )}

      {!allSaturated && saturadosCount > 0 && (
        <p class="mt-6 text-[12px] text-[var(--color-muted)]">
          {saturadosCount} profesional{saturadosCount === 1 ? " tiene" : "es tienen"} la
          agenda completa{" "}
          {referenceFecha ? "para ese día" : "hoy"}. Probá con otra fecha o dejá que
          asignemos a alguien disponible.
        </p>
      )}

      <ul class="mt-8 grid gap-3 sm:grid-cols-2">
        <ProfesionalCard
          id="cualquiera"
          nombre="Cualquiera disponible"
          bio="Asignamos a la primera profesional con horario libre ese día."
          anios={null}
          rating={null}
          saturada={false}
          selected={value === "cualquiera"}
          onClick={() => onChange("cualquiera")}
        />
        {all.map((p) => {
          const sat = saturados.has(p.id);
          const agg = aggregates[p.id] ?? { count: 0, promedio: 0 };
          return (
            <ProfesionalCard
              key={p.id}
              id={p.id}
              nombre={p.nombre}
              bio={p.bio}
              anios={p.aniosExperiencia}
              rating={agg}
              saturada={sat}
              selected={value === p.id && !sat}
              disabled={sat}
              onClick={() => !sat && onChange(p.id)}
            />
          );
        })}
      </ul>

      <div class="mt-8 flex justify-between">
        <button type="button" class="btn-pill btn-ghost" onClick={onBack}>
          <span>Volver</span>
        </button>
        <button type="button" class="btn-pill btn-primary" onClick={onContinue}>
          <span>Continuar</span>
          <span class="icon-bubble !h-5 !w-5" aria-hidden="true">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
}

function ProfesionalCard({
  nombre,
  bio,
  anios,
  rating,
  saturada,
  selected,
  disabled = false,
  onClick,
}: {
  id: string;
  nombre: string;
  bio: string;
  anios: number | null;
  rating: RatingAggregate | null;
  saturada: boolean;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}): JSX.Element {
  const isInactive = disabled || saturada;

  return (
    <li>
      <button
        type="button"
        class="relative w-full rounded-[var(--radius-card)] p-5 text-left transition-all duration-500"
        style={{
          background: selected
            ? "var(--color-clay)"
            : isInactive
            ? "rgba(31,24,18,0.04)"
            : "var(--color-paper-3)",
          color: selected
            ? "var(--color-paper-2)"
            : isInactive
            ? "var(--color-muted)"
            : "var(--color-ink)",
          border: selected
            ? "1px solid var(--color-clay)"
            : "1px solid rgba(31,24,18,0.08)",
          cursor: isInactive ? "not-allowed" : "pointer",
          opacity: isInactive && !selected ? 0.72 : 1,
        }}
        onClick={onClick}
        disabled={isInactive}
        aria-pressed={selected}
        aria-disabled={isInactive}
      >
        <div class="flex items-baseline justify-between gap-3">
          <span class="font-serif text-[19px] leading-[1.15]">{nombre}</span>
          {anios !== null && (
            <span
              class="font-mono text-[11px] tabular-nums"
              style={{
                color: selected
                  ? "var(--color-paper-2)"
                  : "var(--color-ink-2)",
              }}
            >
              {anios} años
            </span>
          )}
        </div>

        {rating !== null && (
          <div class="mt-2">
            <RatingStarsDisplay
              promedio={rating.promedio}
              count={rating.count}
              size="sm"
            />
          </div>
        )}

        <p
          class="mt-3 text-[14px] leading-relaxed"
          style={{
            color: selected
              ? "rgba(250,244,234,0.86)"
              : "var(--color-ink-2)",
          }}
        >
          {bio}
        </p>

        {saturada && (
          <span
            class="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium"
            style="background: rgba(122,130,102,0.18); color: #4d5534;"
          >
            <span
              aria-hidden="true"
              class="inline-block h-1.5 w-1.5 rounded-full"
              style="background: #4d5534;"
            />
            Sin disponibilidad ese día
          </span>
        )}
      </button>
    </li>
  );
}

/* --------------------------- Fecha step ---------------------------- */

function professionalsDisponiblesParaFecha(
  all: Profesional[],
  fecha: string | null,
): Profesional[] {
  if (!fecha) return all;
  const wd = isoWeekday(fromIsoDate(fecha));
  return all.filter((p) => p.diasTrabajo.includes(wd));
}

function FechaStep({
  profesionales: all,
  reservas,
  profesionalesDisponibles,
  value,
  onChange,
  onBack,
  onContinue,
}: {
  profesionales: Profesional[];
  reservas: Reserva[];
  profesionalesDisponibles: Profesional[];
  value: string | null;
  onChange: (d: string) => void;
  onBack: () => void;
  onContinue: () => void;
}): JSX.Element {
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState<{ y: number; m: number }>(() => {
    const t = today();
    return { y: t.getFullYear(), m: t.getMonth() };
  });
  const [weekStart, setWeekStart] = useState<string>(() => {
    const t = today();
    const dow = (t.getDay() + 6) % 7; // Monday=0
    const d = new Date(t);
    d.setDate(t.getDate() - dow);
    return toIsoDate(d);
  });

  const t = today();

  const firstWd = (() => {
    const d = new Date(cursor.y, cursor.m, 1);
    const w = d.getDay();
    return (w + 6) % 7;
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

  const goPrev = () => {
    if (!canGoPrev) return;
    setCursor((c) => {
      const m = c.m - 1;
      if (m < 0) return { y: c.y - 1, m: 11 };
      return { y: c.y, m };
    });
  };

  const goNext = () => {
    setCursor((c) => {
      const m = c.m + 1;
      if (m > 11) return { y: c.y + 1, m: 0 };
      return { y: c.y, m };
    });
  };

  const shiftWeek = (days: number) => {
    const base = fromIsoDate(weekStart);
    base.setDate(base.getDate() + days);
    setWeekStart(toIsoDate(base));
  };

  const available = profesionalesDisponibles.length > 0;

  const isToday = (iso: string): boolean => iso === toIsoDate(t);

  return (
    <div>
      <header>
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Paso 3
        </p>
        <h2 class="mt-2 font-serif text-[28px] leading-[1.1] text-[var(--color-ink)] sm:text-[32px]">
          Elegí el día
        </h2>
        <p class="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          Los días sin disponibilidad aparecen atenuados. Solo mostramos horarios con al
          menos un profesional libre.
        </p>
      </header>

      <div class="mt-6 flex items-center gap-2">
        <div
          role="tablist"
          aria-label="Modo de calendario"
          class="inline-flex rounded-full p-1"
          style="background: var(--color-paper-3);"
        >
          {(
            [
              { id: "month", label: "Mes" },
              { id: "week", label: "Semana" },
            ] as const
          ).map((v) => {
            const active = view === v.id;
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
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {!available && (
        <p class="mt-6 rounded-[var(--radius-input)] border border-[rgba(122,61,46,0.25)] bg-[rgba(122,61,46,0.06)] px-4 py-3 text-[14px] text-[var(--color-clay)]">
          Para esa fecha no hay profesionales disponibles. Probá con otro día o cambiá la
          selección de profesional.
        </p>
      )}

      {value && available && (
        <p class="mt-6 text-[12px] text-[var(--color-muted)]">
          {(() => {
            const sat = all.filter((p) =>
              profesionalesDisponibles.some((d) => d.id === p.id),
            ).filter((p) =>
              contarReservasPorProfesionalEnFecha(reservas, value, p.id) >=
              MAX_RESERVAS_POR_PROFESIONAL_DIA,
            ).length;
            const libres = profesionalesDisponibles.length - sat;
            if (libres === 0) {
              return "Para ese día todas las profesionales están saturadas. Si confirmás, te asignamos a la primera que se libere.";
            }
            return `${libres} profesional${libres === 1 ? "" : "es"} disponible${libres === 1 ? "" : "s"} para ese día${sat > 0 ? ` · ${sat} saturada${sat === 1 ? "" : "s"}` : ""}.`;
          })()}
        </p>
      )}

      <div class="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-[rgba(31,24,18,0.08)]">
        <div
          class="flex items-center justify-between px-4 py-3 sm:px-6"
          style="background: var(--color-paper-3);"
        >
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-300 disabled:opacity-30"
            style="background: rgba(31,24,18,0.06); color: var(--color-ink);"
            onClick={view === "month" ? goPrev : () => shiftWeek(-7)}
            disabled={view === "month" && !canGoPrev}
            aria-label={view === "month" ? "Mes anterior" : "Semana anterior"}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 2 4 6l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <span class="font-serif text-[16px] capitalize text-[var(--color-ink)]">
            {view === "month"
              ? `${MESES[cursor.m]} ${cursor.y}`
              : `Semana del ${formatFechaCorta(weekStart)}`}
          </span>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-300"
            style="background: rgba(31,24,18,0.06); color: var(--color-ink);"
            onClick={view === "month" ? goNext : () => shiftWeek(7)}
            aria-label={view === "month" ? "Mes siguiente" : "Semana siguiente"}
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
          {view === "month" && (
            <div class="grid grid-cols-7 gap-1.5">
              {cells.map((cell, idx) => {
                if (!cell.date || !cell.iso) {
                  return <span key={idx} class="aspect-square" aria-hidden="true" />;
                }
                const inPast =
                  fromIsoDate(cell.iso).getTime() < t.getTime();
                const wd = isoWeekday(cell.date);
                const isSunday = wd === 7;
                const isWorking = profesionalesDisponibles.some((p) =>
                  p.diasTrabajo.includes(wd),
                );
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
          )}
          {view === "week" && (
            <div class="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 7 }).map((_, i) => {
                const base = fromIsoDate(weekStart);
                base.setDate(base.getDate() + i);
                const iso = toIsoDate(base);
                const wd = isoWeekday(base);
                const inPast = fromIsoDate(iso).getTime() < t.getTime();
                const isSunday = wd === 7;
                const isWorking = profesionalesDisponibles.some((p) =>
                  p.diasTrabajo.includes(wd),
                );
                const today = isToday(iso);
                const disabled = inPast || isSunday || !isWorking;
                const selected = value === iso;
                return (
                  <button
                    key={iso}
                    type="button"
                    class="flex flex-col items-center justify-center gap-1 rounded-[12px] py-4 text-[13px] transition-all duration-300"
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
                    }}
                    onClick={() => !disabled && onChange(iso)}
                    disabled={disabled}
                    aria-pressed={selected}
                    aria-label={`${formatFechaLarga(iso)}${today ? ", hoy" : ""}${disabled ? ", no disponible" : ""}`}
                  >
                    <span class="font-serif text-[20px] tabular-nums">
                      {base.getDate()}
                    </span>
                    <span
                      class="font-mono text-[10px] uppercase tracking-[0.16em]"
                      style={{
                        color: selected
                          ? "rgba(250,244,234,0.7)"
                          : "rgba(31,24,18,0.45)",
                      }}
                    >
                      {["L", "M", "X", "J", "V", "S", "D"][i]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <p class="mt-3 text-[12px] text-[var(--color-muted)]">
        Los días marcados con el borde clay son <em>hoy</em>.
      </p>

      <div class="mt-8 flex justify-between">
        <button type="button" class="btn-pill btn-ghost" onClick={onBack}>
          <span>Volver</span>
        </button>
        <button
          type="button"
          class="btn-pill btn-primary"
          disabled={!value}
          onClick={onContinue}
          style={{ opacity: value ? 1 : 0.5, pointerEvents: value ? "auto" : "none" }}
        >
          <span>Continuar</span>
          <span class="icon-bubble !h-5 !w-5" aria-hidden="true">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
}

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ---------------------------- Hora step ---------------------------- */

function HoraStep({
  servicio,
  duracionTotalMin,
  fecha,
  slots,
  ocupados,
  value,
  onChange,
  onBack,
  onContinue,
}: {
  servicio: Servicio;
  duracionTotalMin: number;
  fecha: string;
  slots: string[];
  ocupados: Set<string>;
  value: string | null;
  onChange: (s: string) => void;
  onBack: () => void;
  onContinue: () => void;
}): JSX.Element {
  const disponibles = slots.filter((s) => !ocupados.has(s));
  const isEmpty = disponibles.length === 0;

  return (
    <div>
      <header>
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Paso 4
        </p>
        <h2 class="mt-2 font-serif text-[28px] leading-[1.1] text-[var(--color-ink)] sm:text-[32px]">
          {formatFechaLarga(fecha)}
        </h2>
        <p class="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          {isEmpty
            ? "No quedan horarios libres para este servicio en esta fecha. Probá con otro día."
            : `Slots tachados ya están reservados para ${duracionTotalMin} min. Los demás están disponibles.`}
        </p>
      </header>

      {isEmpty ? (
        <div
          class="mt-8 flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-[rgba(31,24,18,0.18)] p-10 text-center"
          style="background: var(--color-paper-3);"
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.25" />
            <path d="M8 12h8" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
            <path d="M12 8v8" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
          </svg>
          <h3 class="font-serif text-[20px] text-[var(--color-ink)]">Sin horarios libres</h3>
          <p class="max-w-[40ch] text-[13px] text-[var(--color-ink-2)]">
            Probemos con otro día o cambiá la duración del servicio.
          </p>
          <button type="button" class="btn-pill btn-ghost" onClick={onBack}>
            <span>Volver al calendario</span>
          </button>
        </div>
      ) : (
        <div class="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-4 md:gap-3">
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
                title={busy ? "Ocupado" : "Disponible"}
              >
                {formatHora(s)}
              </button>
            );
          })}
        </div>
      )}

      <div class="mt-8 flex justify-between">
        <button type="button" class="btn-pill btn-ghost" onClick={onBack}>
          <span>Volver</span>
        </button>
        <button
          type="button"
          class="btn-pill btn-primary"
          disabled={!value}
          onClick={onContinue}
          style={{ opacity: value ? 1 : 0.5, pointerEvents: value ? "auto" : "none" }}
        >
          <span>Continuar</span>
          <span class="icon-bubble !h-5 !w-5" aria-hidden="true">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
}

/* --------------------------- Datos step ---------------------------- */

function DatosStep({
  servicio,
  servicioIds,
  profesionalId,
  fecha,
  hora,
  duracionTotalMin,
  cliente,
  onChange,
  submitting,
  onBack,
  onSubmit,
  hydrated,
  notasMax,
}: {
  servicio: Servicio;
  servicioIds: Servicio[];
  profesionalId: ProfesionalId | "cualquiera";
  fecha: string;
  hora: string;
  duracionTotalMin: number;
  cliente: BookingDraft["cliente"];
  onChange: (next: BookingDraft["cliente"]) => void;
  submitting: boolean;
  onBack: () => void;
  onSubmit: (e: Event) => void;
  hydrated: boolean;
  notasMax: number;
}): JSX.Element {
  const [errors, setErrors] = useState<{ [k: string]: string }>({});

  const validate = (form: HTMLFormElement): boolean => {
    const data = new FormData(form);
    const next: { [k: string]: string } = {};
    const nombre = String(data.get("nombre") ?? "").trim();
    const telefono = String(data.get("telefono") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const notas = String(data.get("notas") ?? "").trim();

    if (nombre.length < 2) next["nombre"] = "Ingresá tu nombre completo.";
    if (!/^[\d\s+()-]{6,}$/.test(telefono)) next["telefono"] = "Ingresá un teléfono válido.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next["email"] = "Ingresá un email válido.";
    if (notas.length > notasMax) next["notas"] = `Máximo ${notasMax} caracteres.`;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handle = (e: Event) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    if (!validate(form)) return;
    onSubmit(e);
  };

  const profesionalLabel =
    profesionalId === "cualquiera"
      ? "Cualquiera disponible"
      : profesionales.find((p) => p.id === profesionalId)?.nombre ?? "";

  const precioTotal = servicioIds.reduce((acc, s) => acc + (s?.precio ?? 0), 0);

  return (
    <div>
      <header>
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Paso 5
        </p>
        <h2 class="mt-2 font-serif text-[28px] leading-[1.1] text-[var(--color-ink)] sm:text-[32px]">
          Tus datos
        </h2>
      </header>

      <div
        class="mt-6 rounded-[var(--radius-input)] border border-[rgba(31,24,18,0.08)] p-4 text-[14px] sm:p-5"
        style="background: var(--color-paper-3);"
      >
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Resumen
        </p>
        <dl class="mt-2 grid gap-1.5 text-[var(--color-ink)]">
          <div class="flex justify-between gap-3">
            <dt class="text-[var(--color-ink-2)]">Servicios</dt>
            <dd class="text-right">
              {servicioIds.map((s) => s?.nombre).filter(Boolean).join(" + ")}
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
            <dt class="text-[var(--color-ink-2)]">Precio total</dt>
            <dd class="text-right font-mono tabular-nums">{formatPrecio(precioTotal)}</dd>
          </div>
        </dl>
      </div>

      <form class="mt-8 grid gap-4" onSubmit={handle} noValidate>
        <Field
          label="Nombre y apellido"
          name="nombre"
          autocomplete="name"
          required
          value={cliente.nombre}
          onInput={(v) => onChange({ ...cliente, nombre: v })}
          error={errors["nombre"]}
        />
        <div class="grid gap-4 sm:grid-cols-2">
          <Field
            label="Teléfono"
            name="telefono"
            type="tel"
            autocomplete="tel"
            placeholder="+54 9 11 5555-1234"
            required
            value={cliente.telefono}
            onInput={(v) => onChange({ ...cliente, telefono: v })}
            error={errors["telefono"]}
          />
          <Field
            label="Email"
            name="email"
            type="email"
            autocomplete="email"
            placeholder="nombre@correo.com"
            required
            value={cliente.email}
            onInput={(v) => onChange({ ...cliente, email: v })}
            error={errors["email"]}
          />
        </div>
        <div>
          <label
            class="flex items-baseline justify-between text-[13px] font-medium text-[var(--color-ink)]"
            for="notas"
          >
            <span>
              Notas para la profesional{" "}
              <span class="font-normal text-[var(--color-muted)]">(opcional)</span>
            </span>
            <span
              class="font-mono tabular-nums text-[11px]"
              style={{
                color:
                  cliente.notas.length > notasMax
                    ? "var(--color-clay)"
                    : "var(--color-muted)",
              }}
            >
              {cliente.notas.length}/{notasMax}
            </span>
          </label>
          <textarea
            id="notas"
            name="notas"
            rows={3}
            maxLength={notasMax + 50}
            class="field mt-1.5 resize-none"
            placeholder="Si tenés alguna preferencia, indicación o alergia para la profesional, contanos."
            value={cliente.notas}
            onInput={(e) =>
              onChange({
                ...cliente,
                notas: (e.currentTarget as HTMLTextAreaElement).value,
              })
            }
            aria-invalid={errors["notas"] ? "true" : "false"}
            aria-describedby={errors["notas"] ? "notas-error" : undefined}
          />
          {errors["notas"] && (
            <p id="notas-error" class="mt-1.5 text-[12px] text-[var(--color-clay)]">
              {errors["notas"]}
            </p>
          )}
        </div>

        <div class="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button type="button" class="btn-pill btn-ghost" onClick={onBack}>
            <span>Volver</span>
          </button>
          <button
            type="submit"
            class="btn-pill btn-primary"
            disabled={!hydrated || submitting}
            aria-busy={submitting}
          >
            <span>{submitting ? "Guardando…" : "Confirmar reserva"}</span>
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

        <p class="mt-2 text-[12px] text-[var(--color-muted)]">
          Al confirmar, tu reserva se guarda en este navegador. No se envía a ningún
          servidor.
        </p>
      </form>
    </div>
  );
}

interface FieldProps {
  label: string;
  name: string;
  type?: string;
  autocomplete?: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  onInput?: (v: string) => void;
  error?: string;
}

function Field({
  label,
  name,
  type = "text",
  autocomplete,
  placeholder,
  required,
  value,
  onInput,
  error,
}: FieldProps): JSX.Element {
  return (
    <div>
      <label class="block text-[13px] font-medium text-[var(--color-ink)]" for={name}>
        {label}
        {required && (
          <span class="ml-1 text-[var(--color-clay)]" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autocomplete={autocomplete}
        placeholder={placeholder}
        required={required}
        class={`field mt-1.5 ${error ? "field-error" : ""}`}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${name}-error` : undefined}
        value={value}
        onInput={(e) => onInput?.((e.currentTarget as HTMLInputElement).value)}
      />
      {error && (
        <p id={`${name}-error`} class="mt-1.5 text-[12px] text-[var(--color-clay)]">
          {error}
        </p>
      )}
    </div>
  );
}