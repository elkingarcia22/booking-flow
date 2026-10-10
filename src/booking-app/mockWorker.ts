import { setupWorker } from "msw/browser";
import { bookingHandlers } from "@/mocks/booking/handlers";

/** El backend simulado de la reserva: solo sus endpoints (la demo no tiene servidor propio). */
export const bookingWorker = setupWorker(...bookingHandlers);
