import { z } from "zod";
import { api } from "@/lib/api";
import {
  alternativesSchema,
  funnelSchema,
  giftCheckSchema,
  giftPurchasedSchema,
  barberReviewsSchema,
  reviewSavedSchema,
  earliestSchema,
  availabilitySchema,
  bookedAppointmentSchema,
  bookingCatalogSchema,
  branchDetailSchema,
  bookingCustomerSchema,
  bookingShopSchema,
  cancelResultSchema,
  myAppointmentsSchema,
  otpSentSchema,
  phoneCheckSchema,
  otpVerifySchema,
  receiptSentSchema,
  repeatResultSchema,
  suggestionResponseSchema,
  reservationSchema,
  type Alternatives,
  type BookingFunnel,
  type GiftCheck,
  type GiftPurchaseInput,
  type GiftPurchased,
  type PackagePurchaseInput,
  type PackagePurchased,
  packagePurchasedSchema,
  type BarberReview,
  type Earliest,
  type Availability,
  type BookedAppointment,
  type BookingCatalog,
  type BookingCustomer,
  type BookingShop,
  type BranchDetail,
  type CancelResult,
  type MyAppointments,
  type NewCustomerInput,
  type OtpSent,
  type PhoneCheck,
  type OtpVerify,
  type ReceiptSent,
  type RepeatResult,
  type RescheduleInput,
  type Reservation,
  type ReservationInput,
  type SavedCardInput,
  type VisitSuggestion,
  type WaitlistInput,
  type WaitlistJoined,
  waitlistJoinedSchema,
} from "./types";
import type { Promo } from "./pricing";

const promoSchema = z.object({ code: z.string(), type: z.enum(["percent", "amount"]), value: z.number(), firstVisitOnly: z.boolean().optional(), minAppointments: z.number().optional() });

const session = (token: string) => ({ "x-booking-token": token });

/** Contrato de la reserva en línea; ver docs/API_CONTRACT.md. */
export const bookingApi = {
  shop: (signal?: AbortSignal) => api.get<BookingShop>("/booking/shop", { schema: bookingShopSchema, signal }),
  branch: (branchId: string, signal?: AbortSignal) => api.get<BranchDetail>(`/booking/branches/${branchId}`, { schema: branchDetailSchema, signal }),
  catalog: (branchId: string, signal?: AbortSignal) => api.get<BookingCatalog>("/booking/catalog", { query: { branchId }, schema: bookingCatalogSchema, signal }),
  availability: (params: { branchId: string; date: string; serviceIds: readonly string[]; barberId: string | null; exclude?: string }, signal?: AbortSignal) =>
    api.get<Availability>("/booking/availability", {
      query: { branchId: params.branchId, date: params.date, serviceIds: params.serviceIds.join(","), barberId: params.barberId, exclude: params.exclude },
      schema: availabilitySchema,
      signal,
    }),
  alternatives: (params: { branchId: string; date: string; serviceIds: readonly string[]; barberId: string | null }, signal?: AbortSignal) =>
    api.get<Alternatives>("/booking/alternatives", {
      query: { branchId: params.branchId, date: params.date, serviceIds: params.serviceIds.join(","), barberId: params.barberId },
      schema: alternativesSchema,
      signal,
    }),
  earliest: (params: { branchId: string; serviceIds: readonly string[]; barberId: string | null }, signal?: AbortSignal) =>
    api.get<Earliest>("/booking/earliest", { query: { branchId: params.branchId, serviceIds: params.serviceIds.join(","), barberId: params.barberId }, schema: earliestSchema, signal }),
  joinWaitlist: (token: string, input: WaitlistInput) => api.post<WaitlistJoined>("/booking/waitlist", input, { headers: session(token), schema: waitlistJoinedSchema }),
  leaveWaitlist: (token: string, id: string) => api.delete<void>(`/booking/waitlist/${id}`, { headers: session(token) }),
  suggestion: (token: string, signal?: AbortSignal) =>
    api.get<{ suggestion: VisitSuggestion | null }>("/booking/me/suggestion", { headers: session(token), schema: suggestionResponseSchema, signal }),
  createCustomer: (token: string, input: NewCustomerInput) => api.post<BookingCustomer>("/booking/customers", input, { headers: session(token), schema: bookingCustomerSchema }),
  /** Cambia titular o vencimiento de una tarjeta guardada; devuelve el perfil con sus tarjetas al día. */
  updateCard: (token: string, id: string, input: SavedCardInput) => api.patch<BookingCustomer>(`/booking/me/cards/${id}`, input, { headers: session(token), schema: bookingCustomerSchema }),
  removeCard: (token: string, id: string) => api.delete<BookingCustomer>(`/booking/me/cards/${id}`, { headers: session(token), schema: bookingCustomerSchema }),
  checkPromo: (token: string | null, input: { code: string; appointments: number }) =>
    api.post<Promo>("/booking/promo", input, { headers: token ? session(token) : undefined, schema: promoSchema }),
  reserve: (token: string, input: ReservationInput) => api.post<Reservation>("/booking/reservations", input, { headers: session(token), schema: reservationSchema, timeoutMs: 30_000 }),
  checkPhone: (phone: string) => api.post<PhoneCheck>("/booking/phone/check", { phone }, { schema: phoneCheckSchema }),
  requestOtp: (phone: string) => api.post<OtpSent>("/booking/otp/request", { phone }, { schema: otpSentSchema }),
  verifyOtp: (phone: string, code: string) => api.post<OtpVerify>("/booking/otp/verify", { phone, code }, { schema: otpVerifySchema }),
  myAppointments: (token: string, signal?: AbortSignal) => api.get<MyAppointments>("/booking/me/appointments", { headers: session(token), schema: myAppointmentsSchema, signal }),
  reschedule: (token: string, id: string, input: RescheduleInput) => api.patch<BookedAppointment>(`/booking/appointments/${id}`, input, { headers: session(token), schema: bookedAppointmentSchema }),
  barberReviews: (barberId: string, signal?: AbortSignal) => api.get<{ items: BarberReview[]; total: number }>(`/booking/barbers/${barberId}/reviews`, { query: { limit: 3 }, schema: barberReviewsSchema, signal }),
  review: (token: string, id: string, input: { rating: number; comment: string }) =>
    api.post<{ id: string; rating: number }>(`/booking/appointments/${id}/review`, input, { headers: session(token), schema: reviewSavedSchema }),
  trackEvent: (event: { sessionId: string; step: string; surface: string; source: string }) => api.post<void>("/booking/events", event),
  funnel: (days: number, signal?: AbortSignal) => api.get<BookingFunnel>("/booking/funnel", { query: { days }, schema: funnelSchema, signal }),
  buyPackage: (token: string, input: PackagePurchaseInput) => api.post<PackagePurchased>("/booking/packages/buy", input, { headers: session(token), schema: packagePurchasedSchema, timeoutMs: 30_000 }),
  checkGift: (code: string) => api.post<GiftCheck>("/booking/gift-cards/check", { code }, { schema: giftCheckSchema }),
  buyGift: (token: string, input: GiftPurchaseInput) => api.post<GiftPurchased>("/booking/gift-cards", input, { headers: session(token), schema: giftPurchasedSchema, timeoutMs: 30_000 }),
  repeat: (token: string, id: string, input: { everyWeeks: number; count: number }) =>
    api.post<RepeatResult>(`/booking/appointments/${id}/repeat`, input, { headers: session(token), schema: repeatResultSchema }),
  cancel: (token: string, id: string, refundTo: "card" | "credit") => api.post<CancelResult>(`/booking/appointments/${id}/cancel`, { refundTo }, { headers: session(token), schema: cancelResultSchema }),
  addDetails: (token: string, reservationId: string, input: { notes?: string; referencePhotos?: string[] }) =>
    api.post<{ saved: boolean }>(`/booking/reservations/${reservationId}/details`, input, { headers: session(token) }),
  sendReceipt: (reservationId: string, input: { channel: "email" | "sms"; to: string }) => api.post<ReceiptSent>(`/booking/reservations/${reservationId}/receipt`, input, { schema: receiptSentSchema }),
};
