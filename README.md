# Estética Aurora · Sistema de reservas

Aplicación web para que las clientas y clientes de **Estética Aurora** saquen turnos online sin llamar por teléfono ni chatear por WhatsApp. Reemplaza una agenda manual donde se solapaban horarios con un flujo de cinco pasos: servicio → profesional → fecha → hora → datos.

> **Esto es una simulación de portafolio.** No tiene backend ni base de datos. Las reservas se guardan en `localStorage` del navegador donde se hicieron y desaparecen si se limpia el almacenamiento.

---

## Problema

La dueña de una peluquería unisex con 3 sillones gestionaba su agenda por teléfono y WhatsApp. Los sábados, que es el día más fuerte, los turnos se le superponían con frecuencia: dos clientas reservaban el mismo sillón a la misma hora, o el servicio terminaba más tarde de lo previsto y atrasaba todo el día.

## Solución

Una aplicación web SSR (Astro + Preact islands) con un flujo de reserva de cinco pasos: servicio → profesional → fecha → hora → datos. El núcleo es una validación real contra reservas existentes que se persisten en `localStorage`:

- Al cargar la isla, se rehidratan todas las reservas guardadas en el navegador.
- Al elegir fecha, profesional y servicio, se calculan los slots libres filtrando los ocupados por la duración real del servicio.
- Al confirmar, se vuelve a validar contra el estado actual (defensa contra pestañas concurrentes) antes de guardar.
- Cada reserva confirmada genera un código único `AUR-XXXXXX` y se muestra un comprobante en `/reservar/[codigo]`.

El resultado: dos turnos no pueden ocupar el mismo sillón a la misma hora, y la dueña ve una agenda consistente entre refreshes sin necesidad de backend.

## Stack

- **Astro 7.3** con `output: "server"` para soportar rutas dinámicas (`/reservar/[codigo]`).
- **@astrojs/preact** como integración de islas para la UI interactiva.
- **Preact 10** + **@preact/signals 2** dentro de las islas para estado compartido sin prop drilling.
- **Tailwind CSS v4** vía `@tailwindcss/vite` (sin `postcss.config.js`).
- **@astrojs/node** en modo `standalone` para correr el build de producción.
- **TypeScript 6** en modo estricto.
- Datos seed hard-coded en `src/data/servicios.ts`.
- Persistencia 100% en `localStorage` (sin endpoints SSR ni backend).
- Picsum para fotografía atmosférica (semillas deterministas).

### Tipografías

- **Fraunces** — display, headlines con itálicas editoriales.
- **Geist Variable** — texto UI, sin serifa neutra pero con personalidad.
- **Geist Mono** — números tabulares (horarios, precios, códigos).

Auto-hospedadas vía `@fontsource-variable` y `@fontsource` (latin subset, declaradas en `src/styles/global.css`).

### Paleta

Tono cálido "warm dawn", distinto al beige+latón AI-default:

| Token | Hex | Uso |
|---|---|---|
| `--color-paper` | `#f4ece1` | fondo principal |
| `--color-paper-2` | `#faf4ea` | tarjetas, inputs |
| `--color-paper-3` | `#ecdfcb` | acentos suaves |
| `--color-ink` | `#1f1812` | texto principal |
| `--color-clay` | `#7a3d2e` | CTA principal |
| `--color-rose` | `#c99085` | detalle secundario |
| `--color-sage` | `#7a8266` | éxito, "libre" |

---

## Funcionalidades

- Calendario mensual/semanal con navegación, deshabilitando días pasados, domingos y días donde ningún profesional trabaja.
- Slots de 30 minutos entre las 09:00 y las 19:00 (sábados hasta las 21:00). Los slots cuyo servicio excede el horario de cierre se filtran.
- Validación real contra reservas existentes: si el horario ya está ocupado, el slot aparece tachado con patrón de rayado diagonal y `cursor: not-allowed`.
- Cuando se eligió "cualquiera disponible", un slot ocupado por un profesional también bloquea a los otros (cualquiera disponible = "el primero libre, no el primero que pidas").
- **18 servicios** en 5 categorías (corte, color, tratamiento, peinado, estética) con duraciones entre 15 y 120 minutos y precios hard-coded en ARS.
- **5 profesionales** (Lucía Méndez, Carlos Rivero, Camila Reynoso, Joaquín Pereyra, Daniela Bustamante) con biografía, especialidad y días de trabajo diferenciados.
- Servicios encadenables: tras elegir el principal, se sugieren combinaciones compatibles (ej. corte + color) que suman a la duración total.
- Formulario con validación inline (nombre, teléfono con regex, email con regex, notas opcionales con contador).
- Generación de código único de reserva (`AUR-XXXXXX`).
- Página `/reservar/[codigo]` que muestra el comprobante al confirmar (incluye QR, .ics para el calendario, modificación y cancelación).
- Flujos de modificación (`/reservar/modificar/[codigo]`) y cancelación (`/reservar/cancelar/[codigo]`) de reservas existentes.
- Panel de administración (`/admin`) para listar, reprogramar y cancelar reservas con código de acceso (también 100% client-side).
- Sistema de ratings post-visita con agregados por profesional.
- Historial de reservas por teléfono/email (`/historial`).
- Persistencia entre refreshes: `localStorage` guarda todas las reservas y se rehidrata al cargar la isla.
- Reserva persiste incluso si el usuario navega a otra pestaña y vuelve.
- Draft del wizard en `localStorage`: si cerrás la pestaña a mitad del flujo, al volver restaurás servicio + profesional + fecha + hora + datos.

### Islas Preact (9, todas `client:load`)

- `BookingIsland` — wizard principal de 5 pasos (en `/reservar`).
- `Confirmation` — comprobante post-reserva + QR + .ics (en `/reservar/[codigo]`).
- `ModifyBookingIsland` — flujo de modificación (en `/reservar/modificar/[codigo]`).
- `CancelBookingFlow` — cancelación guiada (en `/reservar/cancelar/[codigo]`).
- `RescheduleFlow` — reprogramación embebida dentro de Confirmation.
- `RatingStars` — display + input de estrellas (compartido por BookingIsland, ModifyBookingIsland y Confirmation).
- `RatingSection` — formulario de calificación post-visita (dentro de Confirmation).
- `AdminPanel` — panel admin con código de acceso (en `/admin`).
- `HistorialLookup` — búsqueda de reservas por teléfono/email (en `/historial`).

---

## Decisiones técnicas

- **`@preact/signals` para estado compartido del wizard**: el step actual y las selecciones (servicios, profesional, fecha, hora, datos del cliente) viven en signals exportados desde `BookingIsland.tsx`. El `Stepper` los consume directamente (sin prop drilling) — patrón que se replica en futuras features cross-component.
- **Persistencia 100% en `localStorage`**: no hay endpoints SSR ni base de datos. Las reservas viven en el navegador del cliente bajo `aurora.reservas.v1`, los drafts en `aurora.booking.draft.v1`, y los datos admin en `aurora.admin.*`. Es demo sin backend, intencionalmente.
- **Validación cruzada contra reservas existentes**: cada confirmación corre `validarSlotLibre()` con el estado actual, lo que protege contra race conditions entre pestañas.
- **Sin CSS-in-JS ni librerías de UI**: tokens en `@theme` de Tailwind v4 + componentes en `@layer components` (botones, slots, fields, reveals).
- **Reveal on scroll con IntersectionObserver nativo**, sin librería externa.
- **Textura de grano SVG inline** (no se sirve como asset externo) para mantener el bundle limpio.

---

## Cómo correrlo

```bash
pnpm install
pnpm dev      # abre http://localhost:4321
pnpm build    # genera dist/ con el server standalone
pnpm preview  # sirve el build en preview
```

Para correr el build de producción con la salida del adapter de Node:

```bash
HOST=127.0.0.1 PORT=4321 node dist/server/entry.mjs
```

---

## Estructura

```
src/
├── components/
│   ├── Header.astro          # nav flotante tipo "isla"
│   ├── Footer.astro          # dirección, horarios, equipo
│   ├── booking/
│   │   ├── BookingIsland.tsx     # wizard principal (5 pasos, signals)
│   │   ├── Confirmation.tsx      # comprobante + QR + ICS
│   │   ├── ModifyBookingIsland.tsx
│   │   ├── CancelBookingFlow.tsx
│   │   ├── RescheduleFlow.tsx
│   │   ├── RatingStars.tsx       # display + input (compartido)
│   │   └── RatingSection.tsx     # form de calificación
│   ├── admin/
│   │   └── AdminPanel.tsx        # panel con código de acceso
│   └── historial/
│       └── HistorialLookup.tsx   # búsqueda por teléfono/email
├── data/
│   └── servicios.ts          # 18 servicios + 5 profesionales seed
├── layouts/
│   └── Base.astro            # html, fuentes, JSON-LD, reveal observer
├── lib/
│   ├── horarios.ts           # date math, formatPrecio, slots
│   ├── reservas.ts           # localStorage + validarSlotLibre
│   ├── ratings.ts            # agregados de calificaciones
│   ├── bookingDraft.ts       # persistencia de wizard en curso
│   ├── ics.ts                # generación de .ics
│   ├── qr.ts                 # QR del comprobante
│   └── types.ts              # tipos compartidos
├── pages/
│   ├── index.astro           # home
│   ├── reservar.astro        # flujo principal
│   ├── reservar/[codigo].astro
│   ├── reservar/modificar/[codigo].astro
│   ├── reservar/cancelar/[codigo].astro
│   ├── admin.astro
│   ├── historial.astro
│   ├── contacto.astro
│   ├── sobre-nosotras.astro
│   ├── terminos.astro
│   └── politica-cancelacion.astro
└── styles/
    └── global.css            # @theme tokens + @layer components
```

---

## Limitaciones (a propósito)

- **Sin backend**. Las reservas viven en `localStorage` y son visibles solo en el navegador que las creó. No hay endpoints SSR — todo el flujo es client-side.
- Sin notificaciones reales (no hay mail ni SMS).
- Sin pagos. El precio es informativo.
- El panel admin tiene un código de acceso hard-coded (`aurora`) porque está pensado solo para demo.

---

## Accesibilidad

- Skip-link "Saltar al contenido principal" en `Base.astro` para usuarios de teclado.
- `:focus-visible` global con outline clay; overrides para botones (`offset: 4px`).
- Labels asociados a cada input (`for` + `id`).
- `aria-pressed` en chips de selección.
- `aria-current="page"` en el link activo del nav.
- `aria-invalid` y `aria-describedby` en los inputs con error.
- `role="progressbar"` en el indicador de paso del wizard.
- Contraste WCAG AA: el texto `--color-ink` sobre `#faf4ea` mide ~12:1.
- `prefers-reduced-motion`: todas las transiciones y reveals colapsan a estático.

---

## Performance

- 9 islas Preact cargadas con `client:load` (todas requieren interactividad inmediata).
- Imágenes con `loading="lazy"` salvo la del hero (`fetchpriority="high"`).
- Tailwind v4 con CSS inlining por sección.
- Build de servidor standalone, sin frameworks de servidor extra.
- `@fontsource`/`@fontsource-variable` self-hosted con subset latin (solo se cargan los pesos usados).
- Sin librerías de animación: transiciones con CSS + `IntersectionObserver` nativo para reveals.

---

## SEO

- Meta description por defecto + override por página.
- Open Graph + Twitter Card con `og-default.svg` (1200×630).
- JSON-LD `BeautySalon` con horarios, dirección y teléfono (sincronizado con `Footer.astro`).
- `<link rel="canonical">` derivado de `Astro.site` o `Astro.url`.
- `theme-color` y `lang="es"` declarados.
