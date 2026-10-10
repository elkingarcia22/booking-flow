import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { APP_MESSAGES } from "@/app/i18n";
import { ThemaToaster } from "@/components/feedback";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BookingPage } from "@/features/booking/BookingPage";
import { LocaleProvider } from "@/i18n";
import { queryClient } from "@/lib/query";
import { ThemeProvider } from "@/themes";

/**
 * La reserva en línea sola, sin el resto de la app: lo que se exporta al repo `booking-flow`
 * (`npm run export:booking`). La vista previa (celular, tablet, monitor, widget) en `/` y la
 * página pública en `/reservar?embed=1`; cualquier otra ruta vuelve al inicio.
 */
const router = createBrowserRouter([
  { path: "/", element: <BookingPage standalone /> },
  { path: "/reservar", element: <BookingPage standalone /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export function BookingApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider messages={APP_MESSAGES}>
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>
            <RouterProvider router={router} />
            <ThemaToaster />
          </TooltipProvider>
        </ThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}
