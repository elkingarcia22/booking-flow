import * as React from "react";
import { useAppT } from "@/app/i18n";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Rating } from "@/components/forms";
import { ThemaTabs } from "@/components/navigation";
import { Text } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ListItem, ListItemGroup } from "@/components/data-display/ListItem";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { parseStart } from "../bookingFormat";
import { cancellationTerms } from "../pricing";
import { AppointmentCard } from "../flow/AppointmentCard";
import { useBookingFlow } from "../flow/BookingContext";
import { CancelDialog } from "../flow/CancelDialog";
import { ManageSignIn } from "../flow/ManageSignIn";
import { PayIdentity } from "../flow/PayIdentity";
import { ReceiptView } from "../flow/ReceiptView";
import { RescheduleDrawer } from "../flow/RescheduleDrawer";
import { ReviewSheet } from "../flow/ReviewSheet";
import { SendReceiptDialog } from "../flow/SendReceiptDialog";
import { StepLayout } from "../flow/StepLayout";
import { useMyAppointmentsQuery } from "../queries";
import type { BookedAppointment, Reservation } from "../types";
import { BookingSheet } from "../flow/BookingSheet";

type ManageTab = "upcoming" | "history" | "receipts";
const SKELETON_CARDS = 2;
const STATUS_VARIANT = { scheduled: "secondary", completed: "outline", cancelled: "destructive", no_show: "outline" } as const;

/**
 * «Mis citas»: lo que viene (cambiar la hora o cancelar, con la política a la
 * vista), lo que ya pasó (volver a reservar lo mismo en un toque) y los
 * recibos de lo reservado en línea.
 */
export function ManageStep() {
  const t = useAppT();
  const { state, dispatch, shop, fmt, token: sessionToken } = useBookingFlow();
  // Las citas solo con el código confirmado: la sesión de vista previa (reconocido por su celular) no alcanza.
  const token = state.verified ? sessionToken : null;
  const [tab, setTab] = React.useState<ManageTab>("upcoming");
  const [moving, setMoving] = React.useState<BookedAppointment | null>(null);
  const [cancelling, setCancelling] = React.useState<BookedAppointment | null>(null);
  const [rating, setRating] = React.useState<BookedAppointment | null>(null);
  const [viewing, setViewing] = React.useState<Reservation | null>(null);
  const [sending, setSending] = React.useState<Reservation | null>(null);
  const mine = useMyAppointmentsQuery(token);

  if (!token) {
    return (
      <StepLayout title={t("booking.manage.title")} lead={t("booking.manage.lead")}>
        {/* Reconocido por su celular: el código va directo a ese número. Si no, el celular y luego el código. */}
        {state.customer ? <PayIdentity /> : <ManageSignIn />}
      </StepLayout>
    );
  }

  const cardOf = (item: BookedAppointment) => ({
    personName: item.personName,
    relation: item.guestRelation,
    services: item.serviceNames,
    barberName: item.barberName,
    barberAvatarUrl: item.barberAvatarUrl,
    day: fmt.day(parseStart(item.start)),
    time: fmt.time(parseStart(item.start)),
    duration: t("booking.review.minutes", { count: item.durationMin }),
    price: item.paid > 0 ? `${fmt.money(item.price)} · ${t("booking.manage.paid", { amount: fmt.money(item.paid) })}` : fmt.money(item.price),
    branchName: item.branchName,
  });
  const status = (item: BookedAppointment) => <Badge variant={STATUS_VARIANT[item.status]}>{t(`booking.manage.status.${item.status}`)}</Badge>;
  const data = mine.data;

  const upcoming = (data?.upcoming ?? []).map((item) => {
    const locked = !cancellationTerms({ start: parseStart(item.start), now: new Date(), cancelHours: shop.cancelHours, lateFeePercent: 0, price: 0, paid: 0 }).isFree;
    return (
      <div key={item.id} className="flex flex-col gap-1.5">
        <AppointmentCard
          data={cardOf(item)}
          status={status(item)}
          actions={
            <>
              <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={() => setMoving(item)}>
                <ThemaIcon name="clock" />
                {t("booking.manage.reschedule")}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCancelling(item)}>
                <ThemaIcon name="close" />
                {t("booking.manage.cancel")}
              </Button>
            </>
          }
        />
        {locked && (
          <Text size="xs" tone="muted" className="px-1">
            {t("booking.manage.locked", { hours: shop.cancelHours })}
          </Text>
        )}
      </div>
    );
  });

  const history = (data?.past ?? []).map((item) => (
    <AppointmentCard
      key={item.id}
      data={cardOf(item)}
      status={status(item)}
      muted={item.status === "cancelled"}
      actions={
        <>
          {/* Solo lo que ocurrió se califica, y una vez. */}
          {item.status === "completed" &&
            (item.review ? (
              <span className="flex items-center gap-1.5" aria-label={t("booking.rate.yours", { count: item.review.rating })}>
                <Rating value={item.review.rating} readOnly size="sm" />
              </span>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setRating(item)}>
                <ThemaIcon name="star" />
                {t("booking.rate.cta")}
              </Button>
            ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => dispatch({ type: "repeatLastVisit", lastVisit: { branchId: item.branchId, serviceIds: item.serviceIds, barberId: item.barberId, at: item.start } })}>
            <ThemaIcon name="refresh" />
            {t("booking.manage.rebook")}
          </Button>
        </>
      }
    />
  ));

  return (
    <StepLayout
      title={t("booking.manage.title")}
      lead={t("booking.manage.lead")}
      aside={
        // Salir cierra la sesión y lleva al inicio: quedarse en «Mis citas» pidiendo el código no es salir.
        <Button type="button" variant="ghost" size="sm" onClick={() => dispatch({ type: "restart" })}>
          <ThemaIcon name="logout" />
          {t("booking.manage.logout")}
        </Button>
      }
    >
      <ThemaTabs
        tabs={[
          { id: "upcoming", label: t("booking.manage.upcoming"), badge: data?.upcoming.length ?? 0 },
          { id: "history", label: t("booking.manage.history") },
          { id: "receipts", label: t("booking.manage.receipts") },
        ]}
        activeTabId={tab}
        onTabChange={(id) => setTab(id as ManageTab)}
        className="mb-0"
      />

      {mine.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : tab === "upcoming" ? (
        upcoming.length > 0 ? (
          <div className="flex flex-col gap-3">{upcoming}</div>
        ) : (
          <EmptyState
            icon="calendar"
            title={t("booking.manage.emptyUpcoming")}
            description={t("booking.manage.emptyUpcomingLead")}
            action={
              <Button type="button" onClick={() => dispatch({ type: "restart" })}>
                {t("booking.manage.book")}
              </Button>
            }
          />
        )
      ) : tab === "history" ? (
        history.length > 0 ? <div className="flex flex-col gap-3">{history}</div> : <EmptyState icon="clock" title={t("booking.manage.emptyHistory")} />
      ) : (data?.reservations.length ?? 0) > 0 ? (
        <ListItemGroup>
          {data?.reservations.map((reservation) => (
            <ListItem
              key={reservation.id}
              leading={<IconTile size="md" icon={<ThemaIcon name="ticket" />} />}
              title={t("booking.confirmed.number", { number: reservation.number })}
              description={`${fmt.day(new Date(reservation.createdAt))} · ${reservation.appointments.length} × ${reservation.appointments[0]?.serviceNames[0] ?? ""}`}
              meta={fmt.money(reservation.totals.total)}
              onClick={() => setViewing(reservation)}
            />
          ))}
        </ListItemGroup>
      ) : (
        <EmptyState icon="ticket" title={t("booking.manage.emptyReceipts")} />
      )}

      <RescheduleDrawer appointment={moving} token={token} onOpenChange={(open) => !open && setMoving(null)} />
      <CancelDialog appointment={cancelling} token={token} onOpenChange={(open) => !open && setCancelling(null)} />
      <ReviewSheet appointment={rating} onOpenChange={(open) => !open && setRating(null)} />
      <BookingSheet
        open={viewing !== null}
        onOpenChange={(open) => !open && setViewing(null)}
        title={t("booking.receipt.title")}
        actions={
          <Button
            type="button"
            onClick={() => {
              setSending(viewing);
              setViewing(null);
            }}
          >
            <ThemaIcon name="send" />
            {t("booking.confirmed.receipt")}
          </Button>
        }
      >
        {viewing && <ReceiptView reservation={viewing} fmt={fmt} />}
      </BookingSheet>
      <SendReceiptDialog reservation={sending} onOpenChange={(open) => !open && setSending(null)} />
    </StepLayout>
  );
}
