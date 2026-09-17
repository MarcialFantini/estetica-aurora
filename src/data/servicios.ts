import type { Servicio, Profesional } from "../lib/types";

export const servicios: Servicio[] = [
  {
    id: "corte",
    nombre: "Corte personalizado",
    descripcion:
      "Diseño de corte a medida según la forma del rostro, textura y estilo de vida. Incluye lavado y secado.",
    duracionMin: 45,
    precio: 8500,
    destacado: true,
  },
  {
    id: "color",
    nombre: "Color y mechas",
    descripcion:
      "Coloración completa, balayage, reflejos o mechas californianas. Productos sin amoníaco disponibles.",
    duracionMin: 120,
    precio: 22000,
  },
  {
    id: "brushing",
    nombre: "Brushing",
    descripcion:
      "Peinado profesional para eventos, fiestas o una semana con el cabello perfecto.",
    duracionMin: 30,
    precio: 5500,
  },
  {
    id: "tratamiento",
    nombre: "Tratamiento de hidratación",
    descripcion:
      "Hidratación, keratina o reparación profunda. Devuelve brillo, cuerpo y suavidad al cabello dañado.",
    duracionMin: 60,
    precio: 9800,
  },
  {
    id: "ninos",
    nombre: "Corte infantil",
    descripcion:
      "Corte rápido y amable para menores de 12 años. Sillón adaptado y ambiente tranquilo.",
    duracionMin: 30,
    precio: 4500,
  },
  {
    id: "diseno",
    nombre: "Diseño y recorte de barba",
    descripcion:
      "Perfilado, navaja y tratamiento hidratante para barba. Para clientes que también reservan corte.",
    duracionMin: 30,
    precio: 4800,
  },
];

export const profesionales: Profesional[] = [
  {
    id: "ana",
    nombre: "Ana Suárez",
    especialidad: "Color y mechas",
    bio: "Especialista en balayage y coloración correctiva. 12 años acompañando a clientas que quieren verse y sentirse bien.",
    aniosExperiencia: 12,
    diasTrabajo: [1, 2, 3, 4, 5, 6],
  },
  {
    id: "bruno",
    nombre: "Bruno Iturbe",
    especialidad: "Cortes y barbería",
    bio: "Cortes clásicos y modernos, perfilado de barba. Atiende a clientas y clientes que valoran el detalle.",
    aniosExperiencia: 9,
    diasTrabajo: [2, 3, 4, 5, 6],
  },
  {
    id: "camila",
    nombre: "Camila Reynoso",
    especialidad: "Tratamientos y peinados",
    bio: "Keratina, hidratación profunda y peinados para eventos. Recomendada para cabellos dañados o con frizz.",
    aniosExperiencia: 7,
    diasTrabajo: [1, 3, 4, 5, 6],
  },
];

/** Find a service by id. */
export const servicioPorId = (id: string): Servicio | undefined =>
  servicios.find((s) => s.id === id);

/** Find a professional by id. */
export const profesionalPorId = (id: string): Profesional | undefined =>
  profesionales.find((p) => p.id === id);

/** Featured professional shown on the home page (rotated by month in a real app). */
export const profesionalDelMes = profesionales[0];