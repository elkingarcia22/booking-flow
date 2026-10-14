import * as React from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingApi } from "./api";
import type { GiftPurchaseInput, NewCustomerInput, OtpSent, PackagePurchaseInput, RescheduleInput, ReservationInput, SavedCardInput, WaitlistInput } from "./types";

/** Claves jerárquicas: reservar o cancelar invalida la disponibilidad y «Mis citas» sin tocar el catálogo. */
export const bookingKeys = {
  all: ["booking"] as const,
  shop: () => [...bookingKeys.all, "shop"] as const,
  branch: (branchId: string) => [...bookingKeys.all, "branch", branchId] as const,
  catalog: (branchId: string) => [...bookingKeys.all, "catalog", branchId] as const,
  availabilities: () => [...bookingKeys.all, "availability"] as const,
  availability: (branchId: string, date: string, serviceIds: readonly string[], barberId: string | null, exclude?: string) =>
    [...bookingKeys.availabilities(), branchId, date, serviceIds.join(","), barberId, exclude ?? null] as const,
  suggestion: (token: string) => [...bookingKeys.all, "suggestion", token] as const,
  mine: (token: string) => [...bookingKeys.all, "mine", token] as const,
  /** El último código mandado a un celular (lo que respondió el servidor y cuándo). */
  codeSent: (phone: string) => [...bookingKeys.all, "codeSent", phone.replace(/\D/g, "")] as const,
};

/** Cuánto vale un código ya mandado para no pedir otro solo por volver a la pantalla que lo pide. */
export const CODE_REUSE_MS = 5 * 60_000;

type SentCode = OtpSent & { at: number };

export function useBookingShopQuery() {
  return useQuery({ queryKey: bookingKeys.shop(), queryFn: ({ signal }) => bookingApi.shop(signal), staleTime: 10 * 60_000 });
}

export function useBranchDetailQuery(branchId: string | null) {
  return useQuery({
    queryKey: bookingKeys.branch(branchId ?? ""),
    queryFn: ({ signal }) => bookingApi.branch(branchId as string, signal),
    enabled: branchId !== null,
    staleTime: 10 * 60_000,
  });
}

export function useBookingCatalogQuery(branchId: string | null) {
  return useQuery({
    queryKey: bookingKeys.catalog(branchId ?? ""),
    queryFn: ({ signal }) => bookingApi.catalog(branchId as string, signal),
    enabled: branchId !== null,
    staleTime: 10 * 60_000,
  });
}

export interface AvailabilityParams {
  branchId: string | null;
  date: string;
  serviceIds: readonly string[];
  barberId: string | null;
  /** La cita que se está moviendo: su propia hora cuenta como libre. */
  exclude?: string;
}

export function useAvailabilityQuery(params: AvailabilityParams) {
  return useQuery({
    queryKey: bookingKeys.availability(params.branchId ?? "", params.date, params.serviceIds, params.barberId, params.exclude),
    queryFn: ({ signal }) => bookingApi.availability({ ...params, branchId: params.branchId as string }, signal),
    enabled: params.branchId !== null && params.serviceIds.length > 0,
    // Al cambiar de día se queda el anterior mientras llega: la rejilla no parpadea.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Otros barberos para lo mismo, cuando el elegido no tiene horas ese día. */
export function useAlternativesQuery(params: Omit<AvailabilityParams, "exclude">, enabled: boolean) {
  return useQuery({
    queryKey: [...bookingKeys.all, "alternatives", params.branchId ?? "", params.date, params.serviceIds.join(","), params.barberId] as const,
    queryFn: ({ signal }) => bookingApi.alternatives({ ...params, branchId: params.branchId as string }, signal),
    enabled: enabled && params.branchId !== null && params.serviceIds.length > 0,
    staleTime: 30_000,
  });
}

/*
 * Lo que actúa en nombre del cliente lleva su sesión verificada (el token del código); sin ella,
 * el servidor responde 403.
 */
const needsSession = (token: string | null): string => {
  if (!token) throw new Error("booking_session");
  return token;
};

/** «Lo antes posible»: el primer hueco desde hoy para lo que se está armando. */
export function useEarliestQuery(params: { branchId: string | null; serviceIds: readonly string[]; barberId: string | null }) {
  return useQuery({
    queryKey: [...bookingKeys.availabilities(), "earliest", params.branchId ?? "", params.serviceIds.join(","), params.barberId] as const,
    queryFn: ({ signal }) => bookingApi.earliest({ ...params, branchId: params.branchId as string }, signal),
    enabled: params.branchId !== null && params.serviceIds.length > 0,
    staleTime: 30_000,
  });
}

export function useJoinWaitlistMutation(token: string | null) {
  return useMutation({ mutationFn: (input: WaitlistInput) => bookingApi.joinWaitlist(needsSession(token), input) });
}

export function useLeaveWaitlistMutation(token: string | null) {
  return useMutation({ mutationFn: (id: string) => bookingApi.leaveWaitlist(needsSession(token), id) });
}

/** La próxima visita que le toca según su frecuencia, con horas libres propuestas. */
export function useVisitSuggestionQuery(token: string | null) {
  return useQuery({
    queryKey: bookingKeys.suggestion(token ?? ""),
    queryFn: ({ signal }) => bookingApi.suggestion(token as string, signal),
    enabled: token !== null,
    staleTime: 60_000,
  });
}

/** ¿Ya es cliente? Solo eso: el perfil llega con el código. */
export function useCheckPhoneMutation() {
  return useMutation({ mutationFn: (phone: string) => bookingApi.checkPhone(phone) });
}

/** Pide un código y anota a qué celular y cuándo: así las pantallas que lo mandan solas no piden otro cada vez que se abren. */
export function useRequestCodeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (phone: string) => bookingApi.requestOtp(phone),
    onSuccess: (sent, phone) => queryClient.setQueryData<SentCode>(bookingKeys.codeSent(phone), { ...sent, at: Date.now() }),
  });
}

/**
 * El código mandado hace poco a ese celular, si lo hay. Las pantallas que lo piden solas al abrirse
 * (pago, lista de espera) lo reutilizan: entrar y salir del pago mandaba uno nuevo cada vez y, a la
 * quinta, la barbería respondía «Pediste muchos códigos» sin que la persona hubiera pedido ninguno.
 */
export function useRecentCode(): (phone: string) => OtpSent | null {
  const queryClient = useQueryClient();
  return React.useCallback(
    (phone: string) => {
      const sent = queryClient.getQueryData<SentCode>(bookingKeys.codeSent(phone));
      return sent && Date.now() - sent.at < CODE_REUSE_MS ? { sentTo: sent.sentTo, channel: sent.channel } : null;
    },
    [queryClient]
  );
}

export function useVerifyCodeMutation() {
  return useMutation({ mutationFn: ({ phone, code }: { phone: string; code: string }) => bookingApi.verifyOtp(phone, code) });
}

export function useCreateCustomerMutation(token: string | null) {
  return useMutation({ mutationFn: (input: NewCustomerInput) => bookingApi.createCustomer(needsSession(token), input) });
}

export function useUpdateCardMutation(token: string | null) {
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: SavedCardInput }) => bookingApi.updateCard(needsSession(token), id, input) });
}

export function useRemoveCardMutation(token: string | null) {
  return useMutation({ mutationFn: (id: string) => bookingApi.removeCard(needsSession(token), id) });
}

export function useReserveMutation(token: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ReservationInput) => bookingApi.reserve(needsSession(token), input),
    onSuccess: () => client.invalidateQueries({ queryKey: bookingKeys.availabilities() }),
  });
}

/** Deja fijas las citas de una reserva: una petición por cita, todas a la vez. */
export function useRepeatMutation(token: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, everyWeeks, count }: { ids: readonly string[]; everyWeeks: number; count: number }) => {
      const results = await Promise.all(ids.map((id) => bookingApi.repeat(needsSession(token), id, { everyWeeks, count })));
      return { created: results.flatMap((result) => result.created), skipped: [...new Set(results.flatMap((result) => result.skipped))] };
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: bookingKeys.availabilities() }),
  });
}

export function useBarberReviewsQuery(barberId: string | null) {
  return useQuery({
    queryKey: [...bookingKeys.all, "reviews", barberId ?? ""] as const,
    queryFn: ({ signal }) => bookingApi.barberReviews(barberId as string, signal),
    enabled: barberId !== null,
    staleTime: 60_000,
  });
}

export function useReviewMutation(token: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rating, comment }: { id: string; rating: number; comment: string }) => bookingApi.review(needsSession(token), id, { rating, comment }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: bookingKeys.mine(token ?? "") });
      void client.invalidateQueries({ queryKey: [...bookingKeys.all, "reviews"] });
      void client.invalidateQueries({ queryKey: [...bookingKeys.all, "catalog"] });
    },
  });
}

export function useBuyPackageMutation(token: string | null) {
  return useMutation({ mutationFn: (input: PackagePurchaseInput) => bookingApi.buyPackage(needsSession(token), input) });
}

export function useBuyGiftMutation(token: string | null) {
  return useMutation({ mutationFn: (input: GiftPurchaseInput) => bookingApi.buyGift(needsSession(token), input) });
}

/** El embudo para el dueño (Ajustes › Reservas): pide la sesión de la app. */
export function useBookingFunnelQuery(days = 30) {
  return useQuery({ queryKey: [...bookingKeys.all, "funnel", days] as const, queryFn: ({ signal }) => bookingApi.funnel(days, signal), staleTime: 60_000 });
}

export function useMyAppointmentsQuery(token: string | null) {
  return useQuery({
    queryKey: bookingKeys.mine(token ?? ""),
    queryFn: ({ signal }) => bookingApi.myAppointments(token as string, signal),
    enabled: token !== null,
  });
}

export function useRescheduleMutation(token: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RescheduleInput }) => bookingApi.reschedule(token, id, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: bookingKeys.mine(token) });
      void client.invalidateQueries({ queryKey: bookingKeys.availabilities() });
    },
  });
}

export function useCancelMutation(token: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, refundTo }: { id: string; refundTo: "card" | "credit" }) => bookingApi.cancel(token, id, refundTo),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: bookingKeys.mine(token) });
      void client.invalidateQueries({ queryKey: bookingKeys.availabilities() });
    },
  });
}

export function useReservationDetailsMutation(token: string | null) {
  return useMutation({
    mutationFn: ({ reservationId, input }: { reservationId: string; input: { notes?: string; referencePhotos?: string[] } }) => bookingApi.addDetails(needsSession(token), reservationId, input),
  });
}

export function useSendReceiptMutation() {
  return useMutation({ mutationFn: ({ reservationId, channel, to }: { reservationId: string; channel: "email" | "sms"; to: string }) => bookingApi.sendReceipt(reservationId, { channel, to }) });
}
