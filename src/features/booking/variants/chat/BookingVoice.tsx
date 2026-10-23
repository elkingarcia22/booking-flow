import type { ChatReply } from "@/lib/chat";
import { ChatVoiceMode } from "@/components/chat";
import { useAppT } from "@/app/i18n";
import { useLocale } from "@/i18n";

/**
 * Hablar con Clipper: el modo voz de la app (las ondas, «Di lo que necesitas y haz una pausa…») como
 * una llamada. Lo dicho va a la misma conversación que se escribe (`ask`, ver `useVoiceBridge`),
 * Clipper contesta en voz alta y vuelve a escuchar; las opciones también se tocan. Va en `page`: la
 * rejilla de puntos de Clipper, siguiendo el tema y el modo de la página.
 */
export function BookingVoice({
  open,
  onClose,
  ask,
  onWrite,
  secret = false,
  opening,
}: {
  open: boolean;
  onClose: () => void;
  ask: (text: string) => Promise<ChatReply>;
  onWrite: (text: string) => void;
  secret?: boolean;
  /** El saludo de Clipper al abrir (según de qué experiencia viene). */
  opening?: () => Promise<ChatReply>;
}) {
  const t = useAppT();
  const { locale } = useLocale();
  return (
    <ChatVoiceMode
      open={open}
      onClose={onClose}
      onWrite={onWrite}
      onSend={(text) => void ask(text)}
      ask={ask}
      lang={locale.startsWith("en") ? "en-US" : "es-CO"}
      conversation
      agentName={t("booking.chat.agentName")}
      appearance="page"
      secret={secret}
      opening={opening}
    />
  );
}
