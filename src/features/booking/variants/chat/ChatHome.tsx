import * as React from "react";
import { useAppT } from "@/app/i18n";
import { ClipperOrb } from "@/components/ai-interaction";
import { ChatComposer } from "@/components/chat";
import { Heading, Text } from "@/components/typography";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import { ThemaIcon, type IconName } from "@/icons";
import { cn } from "@/lib/utils";
import { useBookingFlow } from "../../flow/BookingContext";
import { STEP_WIDTH } from "../../flow/stepWidth";

import "./chatHome.css";

interface HomeProps {
  onStart: (text?: string) => void;
  /** «Voz»: abre la conversación por voz con Clipper (vive en `ChatFlow`, que tiene la conversación). */
  onVoice: () => void;
}

interface Idea {
  icon: IconName;
  title: string;
  hint: string;
  prompt: string;
}

/**
 * Las piezas de la portada: el nombre de Clipper, la pregunta, la caja con «Voz» y cuatro ideas
 * para empezar con un toque.
 */
function useHome({ onStart, onVoice }: HomeProps) {
  const t = useAppT();
  const [draft, setDraft] = React.useState("");
  const ideas: Idea[] = [
    { icon: "refresh", title: t("booking.chat.ideaUsual"), hint: t("booking.chat.ideaUsualHint"), prompt: t("booking.chat.homeChip2") },
    { icon: "clock", title: t("booking.chat.ideaSoon"), hint: t("booking.chat.ideaSoonHint"), prompt: t("booking.chat.ideaSoonPrompt") },
    { icon: "scissors", title: t("booking.chat.ideaCombo"), hint: t("booking.chat.ideaComboHint"), prompt: t("booking.chat.homeChip3") },
    { icon: "calendar", title: t("booking.chat.ideaManage"), hint: t("booking.chat.ideaManageHint"), prompt: t("booking.chat.ideaManagePrompt") },
  ];
  const composer = (
    <ChatComposer value={draft} onChange={setDraft} onSend={(text) => onStart(text)} placeholder={t("booking.chat.homePlaceholder")} onVoice={onVoice} disclaimer={false} />
  );
  const skip = (
    <div className="flex justify-center">
      <Button type="button" variant="link" size="sm" onClick={() => onStart()}>
        {t("booking.chat.homeSkip")}
        <ThemaIcon name="arrowRight" />
      </Button>
    </div>
  );
  return { t, ideas, composer, skip };
}

/** El nombre del asistente con el degradado de IA; va bajo su orbe grande, así que no repite el orbe. */
function ClipperName({ className }: { className?: string }) {
  const t = useAppT();
  return (
    <Text as="span" size="sm" weight="semibold" className={cn("text-ai-gradient tracking-wide", className)}>
      {t("agent.name")}
    </Text>
  );
}

/**
 * La portada de Clipper, antes del chat: su orbe (un poste de barbería hecho esfera, con el gradiente
 * de IA) sobre una rejilla de puntos; debajo, la pregunta, la caja (con «Voz», y un
 * haz de luz que recorre su borde) y cuatro ideas numeradas. Lo dicho o escrito abre la
 * conversación y se atiende en cuanto se sabe quién es.
 */
export function ChatHome(props: HomeProps) {
  const { t, ideas, composer, skip } = useHome(props);
  const { layout, isPhone } = useBookingFlow();
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div aria-hidden className="clipper-dots pointer-events-none absolute inset-0" />
      <div className={cn("relative mx-auto flex w-full flex-1 flex-col justify-center gap-7 px-5 py-10", STEP_WIDTH[layout])}>
        <div className="flex flex-col items-center gap-5 text-center">
          {/* El orbe de Clipper: un poste de barbería hecho esfera, con el gradiente de IA. */}
          <ClipperOrb size={layout === "wide" ? 64 : 52} />
          <div className="flex flex-col items-center gap-2">
            <ClipperName />
            <Heading level={layout === "wide" ? 2 : 3}>{t("booking.chat.promptTitle")}</Heading>
            <Text tone="secondary">{t("booking.chat.promptLead")}</Text>
          </div>
        </div>
        <div className="relative rounded-[1.75rem]">
          {composer}
          <BorderBeam size={140} duration={8} colorFrom="var(--color-ai-stop-1)" colorTo="var(--color-ai-stop-3)" />
        </div>
        {/* En celular, una idea debajo de otra; con más ancho, de a dos. */}
        <ol className={cn("grid gap-2", isPhone ? "grid-cols-1" : "grid-cols-2")}>
          {ideas.map((idea, index) => (
            <li key={idea.title}>
              <button
                type="button"
                onClick={() => props.onStart(idea.prompt)}
                className="group flex h-full w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left outline-none transition-colors duration-fast hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border font-mono text-xs text-text-secondary transition-colors group-hover:border-primary/60 group-hover:text-primary">
                  {index + 1}
                </span>
                <span className="flex min-w-0 flex-col">
                  <Text as="span" size="sm" weight="semibold">
                    {idea.title}
                  </Text>
                  <Text as="span" size="xs" tone="muted" className="line-clamp-2">
                    {idea.hint}
                  </Text>
                </span>
              </button>
            </li>
          ))}
        </ol>
        {skip}
      </div>
    </div>
  );
}
