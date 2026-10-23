import * as React from "react";
import { useLocale } from "@/i18n";
import type { BookedAppointment } from "./types";
import { instantOf, offsetLabel } from "@/lib/time/zoned";

/**
 * Fechas, horas y dinero de la reserva. Las horas viajan como ISO local de la
 * sucursal sin zona («2026-10-09T10:30»): la cita es a las 10:30 en la
 * barbería, esté donde esté quien reserva.
 */

const pad = (value: number): string => String(value).padStart(2, "0");

export const dayKeyOf = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Una fecha como «AAAA-MM-DDTHH:mm». */
export const toStart = (date: Date): string => `${dayKeyOf(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** «AAAA-MM-DDTHH:mm» (o con segundos) como fecha local. */
export const parseStart = (value: string): Date => {
  const [day, time = "00:00"] = value.split("T");
  const [year, month, date] = day.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, (month ?? 1) - 1, date ?? 1, hours ?? 0, minutes ?? 0);
};

/** «09:30» como minutos del día. */
export const clockMinutes = (clock: string): number => {
  const [hours, minutes] = clock.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};

export interface BookingFormatters {
  money: (value: number) => string;
  /** «jue 9 oct». */
  day: (date: Date) => string;
  /** «jueves, 9 de octubre». */
  dayLong: (date: Date) => string;
  /** «mié 28»: para chips donde no cabe el mes. */
  dayShort: (date: Date) => string;
  /** «lunes» a partir de su número (0 = domingo). */
  weekday: (day: number) => string;
  /** «10:30 a. m.». */
  time: (date: Date) => string;
  /** «jue 9 oct · 10:30 a. m.». */
  when: (date: Date) => string;
  /** «10:30» del reloj de la barbería a la hora local legible. */
  clock: (clock: string) => string;
}

export function useBookingFormat(currency = "USD"): BookingFormatters {
  const { formatNumber, formatDate } = useLocale();
  return React.useMemo(() => {
    const day = (date: Date) => formatDate(date, { weekday: "short", day: "numeric", month: "short" });
    const time = (date: Date) => formatDate(date, { hour: "numeric", minute: "2-digit" });
    return {
      money: (value: number) => formatNumber(value, { style: "currency", currency, minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }),
      day,
      dayLong: (date: Date) => formatDate(date, { weekday: "long", day: "numeric", month: "long" }),
      weekday: (day: number) => formatDate(new Date(2026, 0, 4 + day), { weekday: "long" }),
      dayShort: (date: Date) => formatDate(date, { weekday: "short", day: "numeric" }).replace(",", ""),
      time,
      when: (date: Date) => `${day(date)} · ${time(date)}`,
      clock: (clock: string) => {
        const minutes = clockMinutes(clock);
        const date = new Date(2026, 0, 1, Math.floor(minutes / 60), minutes % 60);
        return time(date);
      },
    };
  }, [currency, formatDate, formatNumber]);
}

const icsDate = (date: Date): string => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
const icsText = (value: string): string => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** Las citas de una reserva como un archivo de calendario (.ics), una por evento. */
/** Un día y dos horas antes. */
const ICS_ALARMS = ["-P1D", "-PT2H"] as const;

export function buildIcs(appointments: readonly BookedAppointment[], shopName: string): string {
  const events = appointments.map((item) => {
    const start = parseStart(item.start);
    const end = new Date(start.getTime() + item.durationMin * 60_000);
    return [
      "BEGIN:VEVENT",
      `UID:${item.id}@barberlytics`,
      `DTSTAMP:${icsDate(new Date())}`,
      // Con la zona de la sede, el calendario del cliente la pone a la hora correcta aunque viva en otra.
      item.timeZone ? `DTSTART;TZID=${item.timeZone}:${icsDate(start)}` : `DTSTART:${icsDate(start)}`,
      item.timeZone ? `DTEND;TZID=${item.timeZone}:${icsDate(end)}` : `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsText(`${shopName} — ${item.serviceNames.join(" + ")}`)}`,
      `LOCATION:${icsText(item.branchName)}`,
      `DESCRIPTION:${icsText(`${item.personName}\nBarbero: ${item.barberName}`)}`,
      // Avisos del propio calendario: el día antes y dos horas antes, como los recordatorios por WhatsApp.
      ...ICS_ALARMS.flatMap((trigger) => ["BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:${trigger}`, `DESCRIPTION:${icsText(`${shopName}: ${item.serviceNames.join(" + ")}`)}`, "END:VALARM"]),
      "END:VEVENT",
    ].join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Barberlytics//Reserva//ES", ...events, "END:VCALENDAR"].join("\r\n");
}

export type CalendarProvider = "google" | "outlook" | "office" | "yahoo";

/** «2026-10-09T10:30:00»: la hora local de la barbería, como la piden Outlook y Microsoft 365. */
const isoLocal = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;

/**
 * El enlace que abre el calendario del cliente con la cita ya llena, para que la guarde con un
 * toque. No hace falta conectar su cuenta: cada servicio publica este formato de «agregar evento».
 */
export function calendarUrl(provider: CalendarProvider, item: BookedAppointment, shopName: string): string {
  const start = parseStart(item.start);
  const end = new Date(start.getTime() + item.durationMin * 60_000);
  const title = `${shopName} — ${item.serviceNames.join(" + ")}`;
  const details = `${item.personName}\nBarbero: ${item.barberName}`;
  if (provider === "google") {
    const params = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${icsDate(start)}/${icsDate(end)}`, location: item.branchName, details, ...(item.timeZone ? { ctz: item.timeZone } : {}) });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }
  if (provider === "yahoo") {
    const params = new URLSearchParams({ v: "60", title, st: icsDate(start), et: icsDate(end), in_loc: item.branchName, desc: details });
    return `https://calendar.yahoo.com/?${params.toString()}`;
  }
  const host = provider === "office" ? "outlook.office.com" : "outlook.live.com";
  // Outlook toma la hora con su desfase: así no la corre a la zona de quien la guarda.
  const withOffset = (date: Date) => (item.timeZone ? `${isoLocal(date)}${offsetLabel(item.timeZone, instantOf(isoLocal(date), item.timeZone))}` : isoLocal(date));
  const params = new URLSearchParams({ path: "/calendar/action/compose", rru: "addevent", subject: title, startdt: withOffset(start), enddt: withOffset(end), location: item.branchName, body: details });
  return `https://${host}/calendar/0/deeplink/compose?${params.toString()}`;
}

/** Descarga el .ics: en iPhone lo abre el calendario directamente. */
export function downloadIcs(content: string, fileName = "cita.ics"): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Las iniciales de un nombre, para el avatar de quien no tiene foto. */
export const initialsOf = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/** ¿Hoy todavía se puede reservar algo? No si ya pasó el cierre (menos la anticipación mínima). */
export function isTodayOver(closesAt: string, minNoticeMinutes: number, now = new Date()): boolean {
  return now.getHours() * 60 + now.getMinutes() + minNoticeMinutes >= clockMinutes(closesAt);
}

/** El primer día que tiene sentido enseñar: hoy, o mañana si hoy ya cerró. */
export function firstBookableDay(closesAt: string, minNoticeMinutes: number, now = new Date()): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return isTodayOver(closesAt, minNoticeMinutes, now) ? new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1) : today;
}

export const isSameDayAs = (a: Date, b: Date): boolean => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** «+16175550100» → «+1 617 555 0100»; lo que no reconoce, tal cual. */
export function formatPhone(value: string): string {
  const match = /^\+(\d{1,3})(\d{3})(\d{3})(\d{4})$/.exec(value.replace(/[\s()-]/g, ""));
  return match ? `+${match[1]} ${match[2]} ${match[3]} ${match[4]}` : value;
}

export interface DayHours {
  day: number;
  opensAt: string | null;
  closesAt: string | null;
}

export type OpenState = { kind: "open"; closesAt: string } | { kind: "opensLater"; opensAt: string } | { kind: "closed" };

/** ¿Está abierta la sede ahora? Si cierra o abre hoy, a qué hora; si no, cerrada. */
export function openStateOf(hours: readonly DayHours[], now = new Date()): OpenState {
  const today = hours.find((item) => item.day === now.getDay());
  if (!today?.opensAt || !today.closesAt) return { kind: "closed" };
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < clockMinutes(today.opensAt)) return { kind: "opensLater", opensAt: today.opensAt };
  if (minutes < clockMinutes(today.closesAt)) return { kind: "open", closesAt: today.closesAt };
  return { kind: "closed" };
}

/** Los días de la semana empezando en lunes, como se lee un horario. */
export const WEEK_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];
