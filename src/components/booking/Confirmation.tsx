/** @jsxImportSource preact */
import { useEffect, useState } from "preact/hooks";
import type { JSX } from "preact";
import type { Reserva } from "../../lib/types";
import { servicioPorId } from "../../data/servicios";
import { addMinutes, formatFechaLarga, formatHora, formatPrecio } from "../../lib/horarios";
import { cargarReservas } from "../../lib/reservas";

interface Props {
  codigo: string;
}

type State =
  | { status: "loading" }
  | { status: "found"; reserva: Reserva }
  | { status: "missing" };

export default function Confirmation({ codigo }: Props): JSX.Element {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const reservas = cargarReservas();
    const found = reservas.find((r) => r.codigo === codigo);
    if (found) {
      setState({ status: "found", reserva: found });
    } else {
      setState({ status: "missing" });
    }
  }, [codigo]);

  if (state.status === "loading") {
    return <Skeleton />;
  }

  if (state.status === "missing") {
    return <Missing codigo={codigo} />;
  }

  return <Receipt reserva={state.reserva} />;
}

function Skeleton(): JSX.Element {
  return (
    <div class="bezel-shell">
      <div class="bezel-core p-6 sm:p-10" aria-busy="true" aria-live="polite">
        <div class="h-6 w-32 rounded-full bg-[rgba(31,24,18,0.06)]" />
        <div class="mt-6 h-12 w-3/4 rounded-2xl bg-[rgba(31,24,18,0.06)]" />
        <div class="mt-8 grid gap-4 sm:grid-cols-2">
          <div class="h-20 rounded-[var(--radius-input)] bg-[rgba(31,24,18,0.05)]" />
          <div class="h-20 rounded-[var(--radius-input)] bg-[rgba(31,24,18,0.05)]" />
        </div>
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
        <h1 class="display-italic mt-3 font-display text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.05] text-[var(--color-ink)]">
          No encontramos la reserva <em>{codigo}</em>.
        </h1>
        <p class="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          Es posible que el código sea incorrecto, que la reserva se haya hecho desde otro
          navegador, o que el almacenamiento local esté desactivado.
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

function Receipt({ reserva }: { reserva: Reserva }): JSX.Element {
  const servicio = servicioPorId(reserva.servicioId);
  return (
    <div class="bezel-shell">
      <div
        class="bezel-core overflow-hidden p-6 sm:p-10"
        style="background: var(--color-paper-2);"
      >
        <div class="flex flex-wrap items-center gap-3">
          <span
            class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium"
            style="background: rgba(122, 130, 102, 0.18); color: #4d5534;"
          >
            <span
              aria-hidden="true"
              class="inline-block h-1.5 w-1.5 rounded-full"
              style="background: #4d5534;"
            />
            Reserva confirmada
          </span>
          <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-muted)]">
            Comprobante
          </p>
        </div>

        <h1 class="display-italic mt-5 font-display text-[clamp(1.9rem,4.5vw,2.8rem)] leading-[1.05] text-[var(--color-ink)]">
          Listo, <em>te esperamos</em>.
        </h1>
        <p class="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          Guardá tu código. Si necesitás reprogramar, contactanos con este número.
        </p>

        <div
          class="mt-8 inline-flex flex-col rounded-[var(--radius-card)] border border-dashed px-6 py-5"
          style="border-color: rgba(122,61,46,0.4); background: var(--color-paper-3);"
        >
          <span class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
            Tu código
          </span>
          <span
            class="mt-2 font-mono text-[28px] font-medium tabular-nums tracking-[0.06em] text-[var(--color-clay)] sm:text-[34px]"
            aria-label={`Código de reserva ${reserva.codigo}`}
          >
            {reserva.codigo}
          </span>
        </div>

        <dl class="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-[rgba(31,24,18,0.08)] bg-[rgba(31,24,18,0.08)] sm:grid-cols-2">
          <Detail label="Servicio" value={servicio?.nombre ?? reserva.servicioId} />
          <Detail
            label="Fecha"
            value={formatFechaLarga(reserva.fecha)}
          />
          <Detail
            label="Hora"
            value={`${formatHora(reserva.hora)} - ${formatHora(
              addMinutes(reserva.hora, reserva.duracionMin),
            )}`}
          />
          <Detail
            label="Duración"
            value={`${reserva.duracionMin} minutos`}
          />
          <Detail
            label="Cliente"
            value={reserva.cliente.nombre}
          />
          <Detail
            label="Contacto"
            value={
              <span class="block">
                {reserva.cliente.telefono}
                <br />
                <span class="text-[var(--color-ink-2)]">{reserva.cliente.email}</span>
              </span>
            }
          />
          {servicio && (
            <Detail
              label="Precio"
              value={formatPrecio(servicio.precio)}
              className="sm:col-span-2"
            />
          )}
          {reserva.cliente.notas && (
            <Detail
              label="Notas"
              value={reserva.cliente.notas}
              className="sm:col-span-2"
            />
          )}
        </dl>

        <div class="mt-10 flex flex-wrap gap-3">
          <a href="/" class="btn-pill btn-primary">
            <span>Volver al inicio</span>
          </a>
          <a href="/reservar" class="btn-pill btn-ghost">
            <span>Hacer otra reserva</span>
          </a>
        </div>

        <p class="mt-8 text-[12px] text-[var(--color-muted)]">
          Esta reserva está guardada en tu navegador. Si lo limpiás, se pierde.
        </p>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string | JSX.Element;
  className?: string;
}): JSX.Element {
  return (
    <div class={`p-5 ${className}`} style="background: var(--color-paper-2);">
      <dt class="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
        {label}
      </dt>
      <dd class="mt-1.5 text-[15px] leading-relaxed text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}