import { db } from "../db";
import { hashOf } from "../customers/seed";
import { sampleDataOn } from "../sampleData";
import type { MockReview } from "./state";

/**
 * Las reseñas de los barberos: solo de citas que ocurrieron, una por cita, en `db.booking.reviews`.
 * Las de ejemplo (deterministas, del id del barbero) existen solo en la demo (`sampleDataOn`), van
 * marcadas `sample` y **nunca se mezclan con las reales**: en cuanto un barbero tiene una reseña de un
 * cliente, se ven solo las suyas. El promedio y el conteo que ve el cliente salen de aquí.
 */

const COMMENTS: readonly string[] = [
  "Muy puntual y el corte quedó exacto a lo que pedí.",
  "Excelente con la barba, el perfilado perfecto.",
  "Me explicó qué me favorecía. Vuelvo seguro.",
  "Buen ambiente y muy cuidadoso con la navaja.",
  "El fade quedó limpio, sin marcas.",
  "Rápido y prolijo, ideal para antes del trabajo.",
  "Un poco de espera, pero el resultado valió la pena.",
  "Paciente con mi hijo, lo dejó feliz.",
  "",
  "",
];
const NAMES: readonly string[] = ["Carlos R.", "Andrés M.", "Juan P.", "Felipe G.", "Santiago L.", "David C.", "Mateo V.", "Daniel S.", "Nicolás T.", "Sebastián H."];
const DAY_MS = 86_400_000;
const SEEDED_MIN = 12;
const SEEDED_SPREAD = 40;

function seeded(barberId: string, now: Date): MockReview[] {
  const count = SEEDED_MIN + (hashOf(barberId, 7) % SEEDED_SPREAD);
  return Array.from({ length: count }, (_, index) => {
    const h = hashOf(barberId, 100 + index);
    // Casi todas de 4 y 5, alguna de 3: como las reseñas de una barbería buena.
    const rating = h % 10 === 0 ? 3 : h % 3 === 0 ? 4 : 5;
    return {
      id: `rev_seed_${barberId}_${index}`,
      appointmentId: null,
      clientId: null,
      clientName: NAMES[h % NAMES.length],
      barberId,
      rating,
      comment: COMMENTS[(h >>> 3) % COMMENTS.length],
      createdAt: new Date(now.getTime() - (2 + ((h >>> 5) % 120)) * DAY_MS).toISOString(),
      sample: true,
    };
  });
}

/** Todas las reseñas de un barbero, de la más nueva a la más vieja. */
export function reviewsOf(barberId: string, now = new Date()): MockReview[] {
  const mine = (db.booking.reviews ?? []).filter((review) => review.barberId === barberId);
  const all = mine.length > 0 || !sampleDataOn() ? mine : seeded(barberId, now);
  return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** El promedio (una cifra decimal), cuántas y si son de ejemplo: lo que se ve en la tarjeta del barbero. */
export function ratingOf(barberId: string): { rating: number; reviews: number; ratingSample: boolean } {
  const all = reviewsOf(barberId);
  const sum = all.reduce((total, review) => total + review.rating, 0);
  return { rating: all.length === 0 ? 0 : Math.round((sum / all.length) * 10) / 10, reviews: all.length, ratingSample: all.length > 0 && all.every((review) => review.sample === true) };
}

export const reviewOfAppointment = (appointmentId: string): MockReview | undefined => (db.booking.reviews ?? []).find((review) => review.appointmentId === appointmentId);

export function addReview(review: Omit<MockReview, "id" | "createdAt">): MockReview {
  const saved: MockReview = { ...review, id: `rev_${Date.now().toString(36)}`, createdAt: new Date().toISOString() };
  db.booking.reviews = [saved, ...(db.booking.reviews ?? [])];
  return saved;
}
