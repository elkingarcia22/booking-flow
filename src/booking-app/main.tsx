import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";
import "@/styles/globals.css";
import { BookingApp } from "./BookingApp";

/**
 * La entrada de la reserva sola. Es una demo sin servidor: el backend simulado (MSW) arranca
 * siempre antes del primer render. Lo que no simula (la voz de Clipper en `/api/tts`) pasa de largo
 * hacia la función de Vercel.
 */
async function bootstrap() {
  const { bookingWorker } = await import("./mockWorker");
  await bookingWorker.start({ onUnhandledRequest: "bypass", quiet: true });
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BookingApp />
    </StrictMode>
  );
}

void bootstrap();
