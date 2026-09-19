# AGENTS — Estética Aurora (proyecto 07)

Stack: Astro 7.3 + Preact 10 + @preact/signals + @astrojs/node standalone + TS estricto.
Output: server (SSR). Adapter: @astrojs/node standalone.
Persistencia: 100% localStorage (aurora.reservas.v1, aurora.booking.draft.v1, aurora.admin.*). Sin backend.
Cliente ficticio: Estética Aurora (peluquería unisex CABA).
Flujo de reserva: 5 pasos (servicio → profesional → fecha → hora → datos).
Validación contra reservas existentes vía validarSlotLibre().
