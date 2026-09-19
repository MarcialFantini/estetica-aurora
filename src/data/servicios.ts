import type { Servicio, Profesional, CategoriaServicio, ServicioId } from "../lib/types";

/**
 * Catálogo de servicios.
 * 18 servicios en 5 categorías: corte, color, tratamiento, peinado, estética.
 * Precios en ARS (noviembre 2024, antes del cepo). Duraciones realistas.
 */

export const CATEGORIAS: { id: CategoriaServicio; nombre: string; blurb: string }[] = [
  {
    id: "corte",
    nombre: "Corte",
    blurb: "Diseño a medida según la forma del rostro y tu estilo de vida.",
  },
  {
    id: "color",
    nombre: "Color",
    blurb: "Coloración, mechas y técnicas a mano alzada con productos sin amoníaco.",
  },
  {
    id: "tratamiento",
    nombre: "Tratamiento",
    blurb: "Hidratación, keratina, alisado y reparación para cabellos dañados o con frizz.",
  },
  {
    id: "peinado",
    nombre: "Peinado",
    blurb: "Brushing, recogidos y peinados para eventos, fiestas y reuniones.",
  },
  {
    id: "estetica",
    nombre: "Estética",
    blurb: "Manicura y depilación facial para completar tu visita.",
  },
];

export const servicios: Servicio[] = [
  // ── Corte ───────────────────────────────────────────────────────────
  {
    id: "corte-dama",
    nombre: "Corte dama",
    descripcion:
      "Diseño personalizado según la forma del rostro, la textura del cabello y tu rutina. Incluye lavado y secado.",
    duracionMin: 45,
    precio: 8500,
    categoria: "corte",
    destacado: true,
    encadenableCon: ["hidratacion", "matiz", "alisado"],
  },
  {
    id: "corte-caballero",
    nombre: "Corte caballero",
    descripcion:
      "Corte clásico o moderno, con perfilado y máquina. Lavado y styling incluidos.",
    duracionMin: 30,
    precio: 6500,
    categoria: "corte",
    encadenableCon: ["depilacion-facial"],
  },
  {
    id: "corte-nino",
    nombre: "Corte niño",
    descripcion:
      "Para menores de 12 años. Ambiente tranquilo, sillón adaptado y atención paciente.",
    duracionMin: 30,
    precio: 4500,
    categoria: "corte",
  },
  {
    id: "flequillo",
    nombre: "Flequillo",
    descripcion:
      "Recorte y diseño de flequillo. Ideal para refrescar el look entre cortes.",
    duracionMin: 15,
    precio: 2500,
    categoria: "corte",
    encadenableCon: ["matiz"],
  },

  // ── Color ───────────────────────────────────────────────────────────
  {
    id: "coloracion",
    nombre: "Coloración completa",
    descripcion:
      "Cobertura de canas o cambio de tono. Trabajamos con líneas profesionales y opciones sin amoníaco.",
    duracionMin: 90,
    precio: 18000,
    categoria: "color",
    destacado: true,
    encadenableCon: ["corte-dama", "matiz"],
  },
  {
    id: "mechas",
    nombre: "Mechas",
    descripcion:
      "Reflejos o mechas californianas con papel o gorra. Aclarado uniforme y cuidado del largo.",
    duracionMin: 120,
    precio: 22000,
    categoria: "color",
    encadenableCon: ["corte-dama", "matiz"],
  },
  {
    id: "balayage",
    nombre: "Balayage",
    descripcion:
      "Técnica a mano alzada para un degradado natural, con transiciones suaves entre raíz y puntas.",
    duracionMin: 150,
    precio: 26000,
    categoria: "color",
    encadenableCon: ["corte-dama", "matiz"],
  },
  {
    id: "matiz",
    nombre: "Matiz",
    descripcion:
      "Baño de color que neutraliza reflejos amarillos o anaranjados y devuelve el tono deseado.",
    duracionMin: 45,
    precio: 9500,
    categoria: "color",
    encadenableCon: ["corte-dama", "hidratacion"],
  },

  // ── Tratamiento ─────────────────────────────────────────────────────
  {
    id: "keratina",
    nombre: "Keratina",
    descripcion:
      "Alisado progresivo y disciplinado del frizz. Duración aproximada de tres a cuatro meses.",
    duracionMin: 120,
    precio: 24000,
    categoria: "tratamiento",
    destacado: true,
    encadenableCon: ["corte-dama"],
  },
  {
    id: "hidratacion",
    nombre: "Hidratación profunda",
    descripcion:
      "Mascarilla intensiva con masaje capilar. Devuelve cuerpo, brillo y suavidad al cabello reseco.",
    duracionMin: 60,
    precio: 9800,
    categoria: "tratamiento",
    encadenableCon: ["corte-dama", "matiz"],
  },
  {
    id: "cauterizacion",
    nombre: "Cauterización",
    descripcion:
      "Sellado de cutícula con calor para cabellos muy dañados por color o herramientas térmicas.",
    duracionMin: 90,
    precio: 14500,
    categoria: "tratamiento",
    encadenableCon: ["corte-dama"],
  },
  {
    id: "alisado",
    nombre: "Alisado japonés",
    descripcion:
      "Alisado termo-activado de larga duración (hasta seis meses). Para cabellos difíciles, con frizz extremo o que no responden a la keratina tradicional.",
    duracionMin: 150,
    precio: 32000,
    categoria: "tratamiento",
    encadenableCon: ["corte-dama"],
  },
  {
    id: "tratamiento-premium",
    nombre: "Tratamiento capilar premium",
    descripcion:
      "Protocolo completo en tres pasos: diagnóstico con tricoscopía, exfoliación del cuero cabelludo, ampollas de keratina + sellado. Para cabellos que necesitan reset.",
    duracionMin: 120,
    precio: 21000,
    categoria: "tratamiento",
    destacado: true,
    encadenableCon: ["corte-dama"],
  },

  // ── Peinado ─────────────────────────────────────────────────────────
  {
    id: "brushing",
    nombre: "Brushing",
    descripcion:
      "Peinado profesional con brushing y herramientas térmicas. Para una semana con el cabello impecable.",
    duracionMin: 30,
    precio: 5500,
    categoria: "peinado",
    encadenableCon: ["corte-dama"],
  },
  {
    id: "peinado-evento",
    nombre: "Peinado para evento",
    descripcion:
      "Peinado de fiesta, casamiento o evento corporativo. Incluye prueba previa agendada con la profesional.",
    duracionMin: 60,
    precio: 12000,
    categoria: "peinado",
    destacado: true,
  },
  {
    id: "recogido",
    nombre: "Recogido",
    descripcion:
      "Recogido elegante o desenfadado para eventos diurnos o nocturnos. Trabajo sobre cabello limpio.",
    duracionMin: 45,
    precio: 8500,
    categoria: "peinado",
  },

  // ── Estética ────────────────────────────────────────────────────────
  {
    id: "manicura",
    nombre: "Manicura",
    descripcion:
      "Manicura completa: limado, cutículas, hidratación y esmaltado tradicional. Sumá el servicio a tu visita de peluquería y salís lista.",
    duracionMin: 45,
    precio: 7200,
    categoria: "estetica",
  },
  {
    id: "depilacion-facial",
    nombre: "Depilación facial",
    descripcion:
      "Diseño de cejas con cera o hilo. Perfilado profesional según la forma del rostro. Incluye aftercare calmante.",
    duracionMin: 30,
    precio: 5200,
    categoria: "estetica",
    encadenableCon: ["corte-dama", "corte-caballero"],
  },
];

/** Find a service by id. */
export const servicioPorId = (id: string): Servicio | undefined =>
  servicios.find((s) => s.id === id);

/** Services filtered by category. */
export const serviciosPorCategoria = (cat: CategoriaServicio): Servicio[] =>
  servicios.filter((s) => s.categoria === cat);

/** Services flagged as featured (home page cards). */
export const serviciosDestacados = (): Servicio[] =>
  servicios.filter((s) => s.destacado);

/** Services that can be chained after the given service. */
export const serviciosEncadenables = (id: ServicioId): Servicio[] => {
  const base = servicioPorId(id);
  if (!base?.encadenableCon) return [];
  return base.encadenableCon
    .map((id2) => servicioPorId(id2))
    .filter((s): s is Servicio => Boolean(s));
};

// ── Equipo ─────────────────────────────────────────────────────────────

export const profesionales: Profesional[] = [
  {
    id: "lucia",
    nombre: "Lucía Méndez",
    especialidad: "Color y técnicas a mano alzada",
    bio: "Especialista en balayage y coloración correctiva. Le obsesionan los tonos naturales y los reflejos que se ven bien a la luz del sol. Hace 14 años que atiende clientas que vuelven cada tres meses.",
    aniosExperiencia: 14,
    diasTrabajo: [1, 2, 3, 4, 5, 6],
    iniciales: "LM",
  },
  {
    id: "carlos",
    nombre: "Carlos Rivero",
    especialidad: "Cortes clásicos y barbería",
    bio: "Viene del barrio de Flores y se formó con barberos de Montevideo. Cortes prolijos, perfilado de barba con navaja y mucha conversación. Atiende a clientas y clientes que valoran el detalle.",
    aniosExperiencia: 11,
    diasTrabajo: [2, 3, 4, 5, 6],
    iniciales: "CR",
  },
  {
    id: "camila",
    nombre: "Camila Reynoso",
    especialidad: "Tratamientos y peinados",
    bio: "Keratina, hidratación profunda y peinados para eventos. Recomendada para cabellos dañados, con frizz o que pasaron por demasiados procesos químicos.",
    aniosExperiencia: 7,
    diasTrabajo: [1, 3, 4, 5, 6],
    iniciales: "CA",
  },
  {
    id: "joaquin",
    nombre: "Joaquín Pereyra",
    especialidad: "Coloración correctiva y decoloración",
    bio: "El que resuelve lo que otros no pudieron. Trabajó tres años en Brasil haciendo mechas y regresó con una técnica de decoloración que cuida la fibra. Paciente, metódico, le gustan los desafíos.",
    aniosExperiencia: 9,
    diasTrabajo: [1, 2, 4, 5, 6],
    iniciales: "JP",
  },
  {
    id: "daniela",
    nombre: "Daniela Bustamante",
    especialidad: "Peinados de novia y eventos",
    bio: "Viene del mundo del teatro, donde aprendió a trabajar con poco tiempo y mucho volumen. Hace peinados de novia, quinceañeras y eventos corporativos. Si tenés una fecha importante, agendá con tiempo.",
    aniosExperiencia: 6,
    diasTrabajo: [2, 3, 5, 6],
    iniciales: "DB",
  },
];

/** Find a professional by id. */
export const profesionalPorId = (id: string): Profesional | undefined =>
  profesionales.find((p) => p.id === id);

/** Featured professional shown on the home page. */
export const profesionalDelMes = profesionales[0];
