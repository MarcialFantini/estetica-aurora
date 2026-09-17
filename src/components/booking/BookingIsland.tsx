/** @jsxImportSource preact */
import { useEffect, useMemo, useState } from "preact/hooks";
import type { JSX } from "preact";
import { servicios, profesionales, servicioPorId } from "../../data/servicios";
import type {
  Profesional,
  ProfesionalId,
  Reserva,
  Servicio,
  ServicioId,
} from "../../lib/types";
import {
  cargarReservas,
  guardarReservas,
  slotsOcupados,
  validarSlotLibre,
} from "../../lib/reservas";
import {
  MESES,
  addMinutes,
  cmpHHMM,
  formatFechaLarga,
  formatHora,
  formatPrecio,
  fromIsoDate,
  generarCodigoReserva,
  generarSlots,
  isoWeekday,
  toIsoDate,
} from "../../lib/horarios";

interface BookingIslandProps {
  /** Professional pre-selected from query string (optional). */
  prefProfesionalId?: string;
}

type Step = "servicio" | "profesional" | "fecha" | "hora" | "datos" | "confirmado";

const HORARIO_FIN_INCLUSIVE = 19; // last slot starts at this hour
const HORARIO_INICIO = 9;

const today = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const stepLabels: { id: Step; label: string }[] = [
  { id: "servicio", label: "Servicio" },
  { id: "profesional", label: "Profesional" },
  { id: "fecha", label: "Fecha" },
  { id: "hora", label: "Hora" },
  { id: "datos", label: "Tus datos" },
];

export default function BookingIsland(_: BookingIslandProps): JSX.Element {
  const [step, setStep] = useState<Step>("servicio");
  const [servicioId, setServicioId] = useState<ServicioId | null>(null);
  const [profesionalId, setProfesionalId] = useState<ProfesionalId | "cualquiera">(
    "cualquiera",
  );
  const [fecha, setFecha] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);

  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setReservas(cargarReservas());
    setHydrated(true);
  }, []);

  const servicio: Servicio | undefined = servicioId
    ? servicioPorId(servicioId)
    : undefined;

  const slots: string[] = useMemo(() => {
    if (!servicio) return [];
    return generarSlots(HORARIO_INICIO, HORARIO_FIN_INCLUSIVE, 30).filter((s) => {
      // Exclude slots that would end after closing.
      return cmpHHMM(addMinutes(s, servicio.duracionMin), "20:00") <= 0;
    });
  }, [servicio]);

  const ocupados: Set<string> = useMemo(() => {
    if (!fecha || !servicio) return new Set();
    return slotsOcupados(reservas, fecha, profesionalId);
  }, [reservas, fecha, profesionalId, servicio]);

  const onSubmit = (e: Event) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const cliente = {
      nombre: String(data.get("nombre") ?? "").trim(),
      telefono: String(data.get("telefono") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      notas: String(data.get("notas") ?? "").trim() || undefined,
    };

    if (!servicio || !fecha || !hora) return;
    const validacion = validarSlotLibre(reservas, {
      fecha,
      hora,
      duracionMin: servicio.duracionMin,
      profesionalId,
    });
    if (!validacion.ok) {
      // eslint-disable-next-line no-alert
      alert(validacion.motivo);
      return;
    }

    const reserva: Reserva = {
      codigo: generarCodigoReserva(),
      servicioId: servicio.id,
      profesionalId,
      fecha,
      hora,
      duracionMin: servicio.duracionMin,
      cliente,
      creadaEn: new Date().toISOString(),
    };

    const nuevas = [...reservas, reserva];
    setReservas(nuevas);
    guardarReservas(nuevas);

    // Redirect to confirmation route.
    if (typeof window !== "undefined") {
      window.location.href = `/reservar/${reserva.codigo}`;
    }
  };

  return (
    <div class="bezel-shell">
      <div class="bezel-core p-6 sm:p-8 lg:p-10">
        <Stepper step={step} />

        <div class="mt-10">
          {step === "servicio" && (
            <ServicioStep
              value={servicioId}
              onChange={(v) => {
                setServicioId(v);
                setHora(null);
              }}
              onContinue={() => setStep("profesional")}
            />
          )}

          {step === "profesional" && servicio && (
            <ProfesionalStep
              profesionales={profesionales}
              value={profesionalId}
              onChange={setProfesionalId}
              onBack={() => setStep("servicio")}
              onContinue={() => setStep("fecha")}
            />
          )}

          {step === "fecha" && servicio && (
            <FechaStep
              profesionalesDisponibles={professionalsDisponiblesParaFecha(
                profesionales,
                fecha,
              )}
              value={fecha}
              onChange={(d) => {
                setFecha(d);
                setHora(null);
              }}
              onBack={() => setStep("profesional")}
              onContinue={() => setStep("hora")}
            />
          )}

          {step === "hora" && servicio && fecha && (
            <HoraStep
              servicio={servicio}
              fecha={fecha}
              slots={slots}
              ocupados={ocupados}
              value={hora}
              onChange={setHora}
              onBack={() => setStep("fecha")}
              onContinue={() => setStep("datos")}
            />
          )}

          {step === "datos" && servicio && fecha && hora && (
            <DatosStep
              servicio={servicio}
              profesionalId={profesionalId}
              fecha={fecha}
              hora={hora}
              onBack={() => setStep("hora")}
              onSubmit={onSubmit}
              hydrated={hydrated}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Stepper ----------------------------- */

function Stepper({ step }: { step: Step }): JSX.Element {
  const currentIdx = stepLabels.findIndex((s) => s.id === step);
  return (
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
  );
}

/* -------------------------- Servicio step -------------------------- */

function ServicioStep({
  value,
  onChange,
  onContinue,
}: {
  value: ServicioId | null;
  onChange: (v: ServicioId) => void;
  onContinue: () => void;
}): JSX.Element {
  return (
    <div>
      <header>
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Paso 1
        </p>
        <h2 class="mt-2 font-display text-[28px] leading-[1.1] text-[var(--color-ink)] sm:text-[32px]">
          ¿Qué servicio necesitás?
        </h2>
        <p class="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          Elegí el servicio principal. La duración determina los horarios disponibles.
        </p>
      </header>

      <ul class="mt-8 grid gap-3 sm:grid-cols-2">
        {servicios.map((s) => {
          const selected = value === s.id;
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
                onClick={() => onChange(s.id)}
                aria-pressed={selected}
              >
                <div class="flex items-baseline justify-between gap-3">
                  <span class="font-display text-[19px] leading-[1.15]">{s.nombre}</span>
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
                  <span aria-hidden="true">⏱</span> {s.duracionMin} min
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      <div class="mt-8 flex justify-end">
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

/* ------------------------ Profesional step ------------------------ */

function ProfesionalStep({
  profesionales: all,
  value,
  onChange,
  onBack,
  onContinue,
}: {
  profesionales: Profesional[];
  value: ProfesionalId | "cualquiera";
  onChange: (v: ProfesionalId | "cualquiera") => void;
  onBack: () => void;
  onContinue: () => void;
}): JSX.Element {
  return (
    <div>
      <header>
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Paso 2
        </p>
        <h2 class="mt-2 font-display text-[28px] leading-[1.1] text-[var(--color-ink)] sm:text-[32px]">
          ¿Con quién te atendés?
        </h2>
        <p class="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          Si no tenés preferencia, dejá que asignemos a la primera profesional disponible.
        </p>
      </header>

      <ul class="mt-8 grid gap-3 sm:grid-cols-2">
        <ProfesionalCard
          id="cualquiera"
          nombre="Cualquiera disponible"
          bio="Asignamos a la primera profesional con horario libre ese día."
          anios={null}
          selected={value === "cualquiera"}
          onClick={() => onChange("cualquiera")}
        />
        {all.map((p) => (
          <ProfesionalCard
            key={p.id}
            id={p.id}
            nombre={p.nombre}
            bio={p.bio}
            anios={p.aniosExperiencia}
            selected={value === p.id}
            onClick={() => onChange(p.id)}
          />
        ))}
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
  selected,
  onClick,
}: {
  id: string;
  nombre: string;
  bio: string;
  anios: number | null;
  selected: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <li>
      <button
        type="button"
        class="w-full rounded-[var(--radius-card)] p-5 text-left transition-all duration-500"
        style={{
          background: selected ? "var(--color-clay)" : "var(--color-paper-3)",
          color: selected ? "var(--color-paper-2)" : "var(--color-ink)",
          border: selected
            ? "1px solid var(--color-clay)"
            : "1px solid rgba(31,24,18,0.08)",
        }}
        onClick={onClick}
        aria-pressed={selected}
      >
        <div class="flex items-baseline justify-between gap-3">
          <span class="font-display text-[19px] leading-[1.15]">{nombre}</span>
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
  profesionalesDisponibles,
  value,
  onChange,
  onBack,
  onContinue,
}: {
  profesionalesDisponibles: Profesional[];
  value: string | null;
  onChange: (d: string) => void;
  onBack: () => void;
  onContinue: () => void;
}): JSX.Element {
  const [cursor, setCursor] = useState<{ y: number; m: number }>(() => {
    const t = today();
    return { y: t.getFullYear(), m: t.getMonth() };
  });
  const t = today();

  const firstWd = (() => {
    const d = new Date(cursor.y, cursor.m, 1);
    // Render Monday-first: JS Sun=0, Mon=1, ... Sat=6 → Mon=0, Sun=6.
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

  const available = profesionalesDisponibles.length > 0;

  return (
    <div>
      <header>
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Paso 3
        </p>
        <h2 class="mt-2 font-display text-[28px] leading-[1.1] text-[var(--color-ink)] sm:text-[32px]">
          Elegí el día
        </h2>
        <p class="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          Los días sin disponibilidad aparecen atenuados. Solo mostramos horarios con al menos
          un profesional libre.
        </p>
      </header>

      {!available && (
        <p class="mt-6 rounded-[var(--radius-input)] border border-[rgba(122,61,46,0.25)] bg-[rgba(122,61,46,0.06)] px-4 py-3 text-[14px] text-[var(--color-clay)]">
          Para esa fecha no hay profesionales disponibles. Probá con otro día o cambiá la
          selección de profesional.
        </p>
      )}

      <div class="mt-8 overflow-hidden rounded-[var(--radius-card)] border border-[rgba(31,24,18,0.08)]">
        <div
          class="flex items-center justify-between px-4 py-3 sm:px-6"
          style="background: var(--color-paper-3);"
        >
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-300 disabled:opacity-30"
            style="background: rgba(31,24,18,0.06); color: var(--color-ink);"
            onClick={goPrev}
            disabled={!canGoPrev}
            aria-label="Mes anterior"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 2 4 6l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <span class="font-display text-[16px] capitalize text-[var(--color-ink)]">
            {MESES[cursor.m]} {cursor.y}
          </span>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-300"
            style="background: rgba(31,24,18,0.06); color: var(--color-ink);"
            onClick={goNext}
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
              const inPast =
                fromIsoDate(cell.iso).getTime() < t.getTime();
              const wd = isoWeekday(cell.date);
              const isSunday = wd === 7;
              const isWorking = profesionalesDisponibles.some((p) =>
                p.diasTrabajo.includes(wd),
              );
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
                      : "transparent",
                    color: selected
                      ? "var(--color-paper-2)"
                      : disabled
                      ? "rgba(31,24,18,0.28)"
                      : "var(--color-ink)",
                    border: selected
                      ? "1px solid var(--color-clay)"
                      : "1px solid rgba(31,24,18,0.1)",
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                  onClick={() => !disabled && onChange(cell.iso!)}
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={`${formatFechaLarga(cell.iso)}${disabled ? ", no disponible" : ""}`}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      </div>

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

/* ---------------------------- Hora step ---------------------------- */

function HoraStep({
  servicio,
  fecha,
  slots,
  ocupados,
  value,
  onChange,
  onBack,
  onContinue,
}: {
  servicio: Servicio;
  fecha: string;
  slots: string[];
  ocupados: Set<string>;
  value: string | null;
  onChange: (s: string) => void;
  onBack: () => void;
  onContinue: () => void;
}): JSX.Element {
  return (
    <div>
      <header>
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Paso 4
        </p>
        <h2 class="mt-2 font-display text-[28px] leading-[1.1] text-[var(--color-ink)] sm:text-[32px]">
          {formatFechaLarga(fecha)}
        </h2>
        <p class="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          Slots tachados ya están reservados para {servicio.duracionMin} min. Los demás están
          disponibles.
        </p>
      </header>

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
            >
              {formatHora(s)}
            </button>
          );
        })}
      </div>

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
  profesionalId,
  fecha,
  hora,
  onBack,
  onSubmit,
  hydrated,
}: {
  servicio: Servicio;
  profesionalId: ProfesionalId | "cualquiera";
  fecha: string;
  hora: string;
  onBack: () => void;
  onSubmit: (e: Event) => void;
  hydrated: boolean;
}): JSX.Element {
  const [errors, setErrors] = useState<{ [k: string]: string }>({});

  const validate = (form: HTMLFormElement): boolean => {
    const data = new FormData(form);
    const next: { [k: string]: string } = {};
    const nombre = String(data.get("nombre") ?? "").trim();
    const telefono = String(data.get("telefono") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();

    if (nombre.length < 2) next["nombre"] = "Ingresá tu nombre completo.";
    if (!/^[\d\s+()-]{6,}$/.test(telefono)) next["telefono"] = "Ingresá un teléfono válido.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next["email"] = "Ingresá un email válido.";
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

  return (
    <div>
      <header>
        <p class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Paso 5
        </p>
        <h2 class="mt-2 font-display text-[28px] leading-[1.1] text-[var(--color-ink)] sm:text-[32px]">
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
            <dt class="text-[var(--color-ink-2)]">Servicio</dt>
            <dd class="text-right">{servicio.nombre}</dd>
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
              {formatHora(hora)} - {formatHora(addMinutes(hora, servicio.duracionMin))}
            </dd>
          </div>
          <div class="flex justify-between gap-3 border-t border-[rgba(31,24,18,0.08)] pt-2 mt-1">
            <dt class="text-[var(--color-ink-2)]">Precio</dt>
            <dd class="text-right font-mono tabular-nums">{formatPrecio(servicio.precio)}</dd>
          </div>
        </dl>
      </div>

      <form class="mt-8 grid gap-4" onSubmit={handle} noValidate>
        <Field
          label="Nombre y apellido"
          name="nombre"
          autocomplete="name"
          required
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
            error={errors["telefono"]}
          />
          <Field
            label="Email"
            name="email"
            type="email"
            autocomplete="email"
            placeholder="nombre@correo.com"
            required
            error={errors["email"]}
          />
        </div>
        <div>
          <label class="block text-[13px] font-medium text-[var(--color-ink)]" for="notas">
            Notas (opcional)
          </label>
          <textarea
            id="notas"
            name="notas"
            rows={3}
            class="field mt-1.5 resize-none"
            placeholder="Si tenés alguna preferencia o indicación para la profesional, contanos."
          />
        </div>

        <div class="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button type="button" class="btn-pill btn-ghost" onClick={onBack}>
            <span>Volver</span>
          </button>
          <button
            type="submit"
            class="btn-pill btn-primary"
            disabled={!hydrated}
          >
            <span>Confirmar reserva</span>
            <span class="icon-bubble !h-5 !w-5" aria-hidden="true">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
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
  error?: string;
}

function Field({
  label,
  name,
  type = "text",
  autocomplete,
  placeholder,
  required,
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
      />
      {error && (
        <p id={`${name}-error`} class="mt-1.5 text-[12px] text-[var(--color-clay)]">
          {error}
        </p>
      )}
    </div>
  );
}