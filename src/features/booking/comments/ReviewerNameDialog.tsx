import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Field } from "@/components/forms";
import { ModalShell } from "@/components/overlays";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_REVIEWER_NAME } from "./useSharedComments";

interface ReviewerNameDialogProps {
  open: boolean;
  /** Con el nombre escrito (o vacío, que firma como «Revisor»). Cerrar sin escribir tampoco bloquea comentar. */
  onSubmit: (name: string) => void;
}

/** Se pide una vez, al abrir los comentarios: es la firma de lo que esa persona escribe en la hoja. */
export function ReviewerNameDialog({ open, onSubmit }: ReviewerNameDialogProps) {
  const t = useAppT();
  const [name, setName] = React.useState("");
  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    onSubmit(name);
  };
  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => !next && submit()}
      size="sm"
      title={t("booking.comments.nameTitle")}
      description={t("booking.comments.nameHint")}
      actions={
        <Button type="submit" form="reviewer-name-form">
          {t("booking.comments.nameSave")}
        </Button>
      }
    >
      <form id="reviewer-name-form" onSubmit={submit}>
        <Field label={t("booking.comments.nameLabel")}>
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={MAX_REVIEWER_NAME} placeholder={t("booking.comments.namePlaceholder")} autoComplete="name" autoFocus />
        </Field>
      </form>
    </ModalShell>
  );
}
