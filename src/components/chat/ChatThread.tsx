import * as React from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import type { Conversation } from "@/lib/chat";
import { useChatActions, useChatContext } from "./useChat";
import { ChatUserMessage } from "./ChatUserMessage";
import { ChatAgentMessage } from "./ChatAgentMessage";

/** A menos de esto del final, se considera que se está mirando el final. */
const STICKY_PX = 120;

function scrollParent(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

export interface ChatThreadProps {
  conversation: Conversation;
  /** El «Más» de cada respuesta; sin esto no sale el menú. */
  onMore?: (messageId: string, action: "share" | "task" | "report") => void;
  className?: string;
}

/**
 * El hilo de una conversación: las preguntas a la derecha, las respuestas
 * con el destello a la izquierda, y el final siempre a la vista mientras el
 * agente escribe.
 */
export function ChatThread({ conversation, onMore, className }: ChatThreadProps) {
  const t = useT();
  const { lang, onNavigate, onAction } = useChatContext();
  const actions = useChatActions();
  const endRef = React.useRef<HTMLDivElement>(null);
  const messages = conversation.messages;
  const lastId = messages.at(-1)?.id;

  const scrollToEnd = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    endRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const logRef = React.useRef<HTMLDivElement>(null);

  // Un mensaje nuevo lleva el hilo al final; el texto que crece, también.
  React.useEffect(() => {
    scrollToEnd();
  }, [messages.length, scrollToEnd]);

  // Lo que aparece al terminar (una tarjeta, una pregunta, las sugerencias)
  // también hace crecer el hilo: si se estaba mirando el final, se sigue
  // mirando; si la persona subió a releer, no se le mueve.
  React.useEffect(() => {
    const log = logRef.current;
    if (!log || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const scroller = scrollParent(log);
      if (!scroller) return;
      const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      if (distance < STICKY_PX) scrollToEnd("auto");
    });
    observer.observe(log);
    return () => observer.disconnect();
  }, [scrollToEnd]);

  return (
    <div ref={logRef} role="log" aria-label={t("chat.title")} aria-live="polite" className={cn("flex flex-col gap-6", className)} data-testid="chat-thread">
      {messages.map((message, index) =>
        message.role === "user" ? (
          <ChatUserMessage key={message.id} message={message} onEdit={(text) => actions.edit(message.id, text)} />
        ) : (
          <ChatAgentMessage
            key={message.id}
            message={message}
            isLast={message.id === lastId}
            lang={lang}
            onStop={(shown) => actions.stop(message.id, shown)}
            onFinish={() => actions.finish(message.id)}
            onProgress={() => scrollToEnd("auto")}
            onFeedback={(value, detail) => actions.feedback(message.id, value, detail)}
            onRegenerate={index === messages.length - 1 ? actions.regenerate : undefined}
            onFollowup={actions.send}
            onAnswer={(option) => actions.answer(message.id, option)}
            onNavigate={onNavigate}
            onMore={onMore ? (action) => onMore(message.id, action) : undefined}
            onAction={onAction ? (action, op) => void actions.runAction(message.id, action, op) : undefined}
            onDiscardAction={(actionId) => actions.discardAction(message.id, actionId)}
          />
        )
      )}
      <div ref={endRef} aria-hidden className="h-px shrink-0" />
    </div>
  );
}
