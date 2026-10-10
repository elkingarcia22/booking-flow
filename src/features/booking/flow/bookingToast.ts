import { toast as sonner, type ExternalToast } from "sonner";

/**
 * Los avisos de la reserva salen dentro de su propia pantalla (el marco del celular,
 * la tablet o el monitor de la vista previa, o el widget), no en la esquina de la
 * ventana: van a su `ThemaToaster` con este id, que `BookingFlow` monta dentro.
 */
export const BOOKING_TOASTER_ID = "booking";

type Message = Parameters<typeof sonner>[0];
const inBooking = (data?: ExternalToast): ExternalToast => ({ ...data, toasterId: BOOKING_TOASTER_ID });

/** El mismo `toast` de Sonner, dirigido al contenedor de la reserva. */
export const toast = Object.assign((message: Message, data?: ExternalToast) => sonner(message, inBooking(data)), {
  success: (message: Message, data?: ExternalToast) => sonner.success(message, inBooking(data)),
  error: (message: Message, data?: ExternalToast) => sonner.error(message, inBooking(data)),
  info: (message: Message, data?: ExternalToast) => sonner.info(message, inBooking(data)),
  warning: (message: Message, data?: ExternalToast) => sonner.warning(message, inBooking(data)),
  dismiss: sonner.dismiss,
});
