import * as React from "react";
import { useAppT, type AppMessageKey } from "@/app/i18n";
import { Chip } from "@/components/ai-interaction";
import { Field } from "@/components/forms";
import { ListItem, ListItemGroup } from "@/components/data-display/ListItem";
import { Heading, Text } from "@/components/typography";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemaIcon } from "@/icons";
import type { BookingPerson } from "../bookingState";
import { initialsOf } from "../bookingFormat";
import { useBookingFlow } from "./BookingContext";
import { BookingSheet } from "./BookingSheet";
import { toastMissing } from "./missingData";

const RELATIONS: readonly AppMessageKey[] = [
  "booking.person.relation.child",
  "booking.person.relation.partner",
  "booking.person.relation.parent",
  "booking.person.relation.sibling",
  "booking.person.relation.friend",
  "booking.person.relation.other",
];
const MIN_NAME = 2;

const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

interface KnownPerson {
  key: string;
  person: Extract<BookingPerson, { kind: "guest" | "new" }>;
}

/**
 * La hoja de «¿Para quién más?»: la gente ya ligada a su perfil (su hijo, su pareja, un amigo que
 * trajo antes) y las que sumó en esta misma reserva, a un toque; debajo, agregar a alguien nuevo
 * con nombre y parentesco. El recordatorio le llega a quien reserva.
 */
export function PersonSheet({ open, onOpenChange, person, onChoose }: { open: boolean; onOpenChange: (open: boolean) => void; person: BookingPerson; onChoose: (person: BookingPerson) => void }) {
  const t = useAppT();
  const { state } = useBookingFlow();
  const [name, setName] = React.useState("");
  const [relation, setRelation] = React.useState<string>(t(RELATIONS[0]));
  const [touched, setTouched] = React.useState(false);

  const known: KnownPerson[] = [
    ...(state.customer?.guests ?? []).map((guest) => ({ key: guest.id, person: { kind: "guest" as const, guestId: guest.id, name: guest.name, relation: guest.relation } })),
    ...state.items
      .map((item) => item.person)
      .filter((item): item is Extract<BookingPerson, { kind: "new" }> => item.kind === "new")
      .map((item) => ({ key: `new-${item.name}`, person: item })),
  ].filter((entry, index, all) => all.findIndex((other) => sameName(other.person.name, entry.person.name)) === index);
  const isPicked = (entry: KnownPerson) => person.kind !== "self" && sameName(person.name, entry.person.name);

  const choose = (next: BookingPerson) => {
    onChoose(next);
    onOpenChange(false);
  };
  const addNew = () => {
    setTouched(true);
    if (toastMissing(t, [name.trim().length < MIN_NAME && t("booking.person.nameError")])) return;
    choose({ kind: "new", name: name.trim(), relation });
    setName("");
    setTouched(false);
  };

  return (
    <BookingSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("booking.person.addTitle")}
      description={t("booking.person.addLead")}
      actions={
        <Button type="button" className="w-full" onClick={addNew}>
          <ThemaIcon name="userAdd" />
          {t("booking.person.addConfirm")}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        {known.length > 0 && (
          <section className="flex flex-col gap-2" aria-labelledby="known-people">
            <Heading level={6} id="known-people">
              {t("booking.person.savedTitle")}
            </Heading>
            <ListItemGroup>
              {known.map((entry) => (
                <ListItem
                  key={entry.key}
                  leading={
                    <Avatar>
                      <AvatarFallback>{initialsOf(entry.person.name)}</AvatarFallback>
                    </Avatar>
                  }
                  title={entry.person.name}
                  description={entry.person.relation || undefined}
                  meta={isPicked(entry) ? <ThemaIcon name="check" size="sm" tone="primary" /> : undefined}
                  selected={isPicked(entry)}
                  onClick={() => choose(entry.person)}
                />
              ))}
            </ListItemGroup>
          </section>
        )}

        <section className="flex flex-col gap-4" aria-labelledby="new-person">
          <Heading level={6} id="new-person">
            {known.length > 0 ? t("booking.person.newTitle") : t("booking.person.firstTitle")}
          </Heading>
          <Field label={t("booking.person.name")} required error={touched && name.trim().length < MIN_NAME ? t("booking.person.nameError") : undefined}>
            <Input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addNew()} autoComplete="off" />
          </Field>
          <div className="flex flex-col gap-2">
            <Text size="sm" weight="medium">
              {t("booking.person.relation")}
            </Text>
            <div role="radiogroup" aria-label={t("booking.person.relation")} className="flex flex-wrap gap-2">
              {RELATIONS.map((key) => (
                <Chip key={key} label={t(key)} selected={relation === t(key)} onClick={() => setRelation(t(key))} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </BookingSheet>
  );
}

/**
 * «¿Para quién es la cita?». Para mí, o para otra persona: ver `PersonSheet`.
 */
export function PersonPicker() {
  const t = useAppT();
  const { state, dispatch } = useBookingFlow();
  const [isOpen, setIsOpen] = React.useState(false);
  const person = state.draft?.person ?? { kind: "self" };

  return (
    <section aria-label={t("booking.person.title")} className="flex flex-col gap-2">
      <Text size="sm" weight="medium">
        {t("booking.person.title")}
      </Text>
      <div className="flex flex-wrap gap-2">
        <Chip label={t("booking.person.self")} icon="users" selected={person.kind === "self"} onClick={() => dispatch({ type: "setPerson", person: { kind: "self" } })} />
        {person.kind !== "self" && <Chip label={person.relation ? `${person.name} · ${person.relation}` : person.name} selected onClick={() => setIsOpen(true)} />}
        <Chip label={person.kind === "self" ? t("booking.person.add") : t("booking.person.change")} icon="userAdd" tone="primary" onClick={() => setIsOpen(true)} />
      </div>
      <PersonSheet open={isOpen} onOpenChange={setIsOpen} person={person} onChoose={(next) => dispatch({ type: "setPerson", person: next })} />
    </section>
  );
}
