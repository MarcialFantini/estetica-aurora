# Estética Aurora · Sistema de reservas

Aplicación web para que las clientas y clientes de **Estética Aurora** saquen turnos online sin llamar por teléfono ni chatear por WhatsApp. Reemplaza una agenda manual donde se solapaban horarios con un flujo de cinco pasos: servicio → profesional → fecha → hora → datos.

> **Esto es una simulación de portafolio.** No tiene backend ni base de datos. Las reservas se guardan en `localStorage` del navegador donde se hicieron y desaparecen si se limpia el almacenamiento.

---

## Problema

La dueña de una peluquería unisex con 3 sillones gestionaba su agenda por teléfono y WhatsApp. Los sábados, que es el día más fuerte, los turnos se le superponían con frecuencia: dos clientas reservaban el mismo sillón a la misma hora, o el servicio terminaba más tarde de lo previsto y atrasaba todo el día.

## Solución

Una aplicación web estática (Astro + Preact islands) con un flujo de reserva de cinco pasos: servicio → profesional → fecha → hora → datos. El núcleo es una validación real contra reservas existentes que se persisten en `localStorage`:

- Al cargar la isla, se rehidratan todas las reservas guardadas en el navegador.
- Al elegir fecha, profesional y servicio, se calculan los slots libres filtrando los ocupados por la duración real del servicio.
- Al confirmar, se vuelve a validar contra el estado actual (defensa contra pestañas concurrentes) antes de guardar.
- Cada reserva confirmada genera un código único `AUR-XXXXXX` y se muestra un comprobante en `/reservar/[codigo]`.

El resultado: dos turnos no pueden ocupar el mismo sillón a la misma hora, y la dueña ve una agenda consistente entre refreshes sin necesidad de backend.

## Stack

- **Astro 7** con `output: "server"` para soportar rutas dinámicas (`/reservar/[codigo]`).
- **@astrojs/preact** como integración de islas para la UI interactiva.
- **Preact + @preact/signals-friendly hooks** dentro de las islas.
- **Tailwind CSS v4** vía `@tailwindcss/vite` (sin `postcss.config.js`).
- **@astrojs/node** en modo `standalone` para correr el build de producción.
- Datos seed hard-coded en `src/data/servicios.ts`.
- Persistencia en `localStorage` (`aurora.reservas.v1`).
- Picsum para fotografía atmosférica (semillas deterministas).

### Tipografías

- **Fraunces** — display, headlines con itálicas editoriales.
- **Geist** — texto UI, sin serifa neutra pero con personalidad.
- **Geist Mono** — números tabulares (horarios, precios, códigos).

Cargadas desde [Bunny Fonts](https://fonts.bunny.net/), CDN que respeta la privacidad.

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

- Calendario mensual con navegación mes a mes, deshabilitando días pasados, domingos y días donde ningún profesional trabaja.
- Slots de 30 minutos entre las 09:00 y las 19:00. Los slots cuyo servicio excede el horario de cierre se filtran.
- Validación real contra reservas existentes: si el horario ya está ocupado, el slot aparece tachado con patrón de rayado diagonal y `cursor: not-allowed`.
- Cuando se eligió "cualquiera disponible", un slot ocupado por un profesional también bloquea a los otros (cualquiera disponible = "el primero libre, no el primero que pidas").
- 6 servicios seed (corte, color, brushing, tratamiento, corte infantil, diseño de barba) con duraciones entre 30 y 120 minutos y precios hard-coded en ARS.
- 3 profesionales seed (Ana, Bruno, Camila) con biografía, especialidad y días de trabajo diferenciados.
- Formulario con validación inline (nombre, teléfono con regex, email con regex, notas opcionales).
- Generación de código único de reserva (`AUR-XXXXXX`).
- Página `/reservar/[codigo]` que muestra el comprobante al confirmar.
- Persistencia entre refreshes: `localStorage` guarda todas las reservas y se rehidrata al cargar la isla.
- Reserva persiste incluso si el usuario navega a otra pestaña y vuelve.

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
│   └── booking/
│       ├── BookingIsland.tsx # flujo de reserva en 5 pasos
│       └── Confirmation.tsx  # comprobante post-reserva
├── data/
│   └── servicios.ts          # servicios y profesionales seed
├── layouts/
│   └── Base.astro            # html, fuentes, reveal observer
├── lib/
│   ├── horarios.ts           # date math, formatPrecio, slots
│   ├── reservas.ts           # localStorage + validación
│   └── types.ts              # tipos compartidos
├── pages/
│   ├── index.astro           # home
│   ├── reservar.astro        # flujo principal
│   └── reservar/[codigo].astro
└── styles/
    └── global.css            # tokens @theme + componentes
```

---

## Limitaciones (a propósito)

- Sin backend. Las reservas viven en `localStorage` y son visibles solo en el navegador que las creó.
- Sin notificaciones reales (no hay mail ni SMS).
- Sin pagos. El precio es informativo.
- El calendario mockea "3 profesionales disponibles" sin impedir reservar el mismo profesional dos veces seguidas si así lo pide la clienta. La validación cruzada ya está implementada para evitar superposiciones reales.

---

## Accesibilidad

- Labels asociados a cada input (`for` + `id`).
- `aria-pressed` en chips de selección.
- `aria-current="page"` en el link activo del nav.
- `aria-invalid` y `aria-describedby` en los inputs con error.
- Contraste WCAG AA: el texto `--color-ink` sobre `#faf4ea` mide ~12:1.
- `prefers-reduced-motion`: todas las transiciones y reveals colapsan a estático.

---

## Performance

- Una sola isla Preact (`BookingIsland`) se carga con `client:load`. La confirmación (`Confirmation`) se carga también como isla pero solo cuando el usuario navega al comprobante.
- Imágenes con `loading="lazy"` salvo la del hero (`fetchpriority="high"`).
- Tailwind v4 con CSS inlining por sección.
- Build de servidor standalone, sin frameworks de servidor extra.