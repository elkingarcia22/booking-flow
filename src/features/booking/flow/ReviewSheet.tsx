import * as React from "react";
import { toast } from "./bookingToast";
import { useAppT } from "@/app/i18n";
import { Field, Rating } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { describeError } from "@/lib/api";
import { useReviewMutation } from "../queries";
import type { BookedAppointment } from "../types";
import { BookingSheet } from "./BookingSheet";
import { useBookingFlow } from "./BookingContext";

const MAX_COMMENT = 500;

/**
 * Calificar una cita que ya pasó: las estrellas (obligatorias) y un comentario opcional. Se
 * publica con el nombre y la inicial del apellido, y alimenta el promedio del barbero.
 */
export function ReviewSheet({ appointment, onOpenChange }: { appointment: BookedAppointment | null; onOpenChange: (open: boolean) => void }) {
  const t = useAppT();
  const { state } = useBookingFlow();
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const review = useReviewMutation(state.token);

  const send = () => {
    if (!appointment || rating === 0) return;
    review.mutate(
      { id: appointment.id, rating, comment: comment.trim() },
      {
        onSuccess: () => {
          toast.success(t("booking.review.thanks"));
          onOpenChange(false);
          setRating(0);
          setComment("");
        },
      }
    );
  };

  return (
    <BookingSheet
      open={appointment !== null}
      onOpenChange={onOpenChange}
      title={t("booking.rate.title", { name: appointment?.barberName.split(" ")[0] ?? "" })}
      description={t("booking.rate.lead")}
      actions={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={send} disabled={rating === 0 || review.isPending}>
            {t("booking.rate.send")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label={t("booking.rate.stars")} error={review.isError ? describeError(review.error).description : undefined}>
          <Rating value={rating} onValueChange={setRating} size="lg" aria-label={t("booking.rate.stars")} />
        </Field>
        <Field label={t("booking.rate.comment")} description={t("booking.rate.commentHint")}>
          <Textarea value={comment} onChange={(event) => setComment(event.target.value.slice(0, MAX_COMMENT))} rows={3} placeholder={t("booking.rate.commentPlaceholder")} />
        </Field>
      </div>
    </BookingSheet>
  );
}
