import * as React from "react";
import { cn } from "@/lib/utils";
import { ThemaIcon } from "@/icons/ThemaIcon";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ai-interaction/Chip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Text } from "@/components/typography";
import { useT } from "@/i18n";
import { speak, type ChatAction, type ChatMessage } from "@/lib/chat";
import { ChatMark } from "./ChatMark";
import { ChatMarkdown } from "./ChatMarkdown";
import { ChatThinking } from "./ChatThinking";
import { ChatQuestionCard } from "./ChatQuestionCard";
import { ChatCardView } from "./ChatCardView";
import { ChatActionCard } from "./ChatActionCard";
import { ChatFeedbackForm, type ChatFeedbackPayload } from "./ChatFeedbackForm";
import { useStreamedText } from "./useStreamedText";
import "./chat.css";

export interface ChatAgentMessageProps {
  message: ChatMessage;
  /** La última respuesta: acciones siempre a la vista, sugerencias y pregunta activas. */
  isLast: boolean;
  lang: string;
  onStop: (shownText: string) => void;
  onFinish: () => void;
  onProgress?: () => void;
  onFeedback: (value: "up" | "down" | undefined, detail?: ChatFeedbackPayload) => void;
  onRegenerate?: () => void;
  onFollowup: (text: string) => void;
  onAnswer: (option: string) => void;
  onNavigate?: (href: string) => void;
  /** «Más»: compartir, crear tarea, reportar. Sin esto no hay menú. */
  onMore?: (action: "share" | "task" | "report") => void;
  /** Aplicar o deshacer un cambio propuesto; sin esto las propuestas no tienen botón. */
  onAction?: (action: ChatAction, op: "apply" | "undo") => void;
  onDiscardAction?: (actionId: string) => void;
}

function ActionButton({ label, name, active, onClick }: { label: string; name: React.ComponentProps<typeof ThemaIcon>["name"]; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
      )}
    >
      <ThemaIcon className="text-current" name={name} size="xs" decorative />
    </button>
  );
}

/**
 * Una respuesta del agente. Se escribe sola y se puede detener; al terminar
 * enseña de dónde salió, lo que trae (una tarjeta, una pregunta, un enlace)
 * y las acciones: copiar, útil o no, regenerar, leer en voz alta. Las
 * sugerencias para seguir salen solo en la última.
 */
export function ChatAgentMessage({ message, isLast, lang, onStop, onFinish, onProgress, onFeedback, onRegenerate, onFollowup, onAnswer, onNavigate, onMore, onAction, onDiscardAction }: ChatAgentMessageProps) {
  const t = useT();
  const streaming = message.status === "streaming";
  const { shown, done } = useStreamedText(message.text, streaming, { onDone: onFinish, onProgress });
  const shownRef = React.useRef(shown);
  React.useEffect(() => {
    shownRef.current = shown;
  }, [shown]);
  const [copied, setCopied] = React.useState(false);
  const [reading, setReading] = React.useState(false);
  const [askingWhy, setAskingWhy] = React.useState(false);
  const stopReading = React.useRef<() => void>(() => {});

  React.useEffect(() => () => stopReading.current(), []);

  if (message.status === "pending") {
    return (
      <div className="flex items-start gap-3" data-testid="chat-agent" data-status="pending">
        <ChatThinking since={message.createdAt} />
      </div>
    );
  }

  const finished = done && !streaming;
  const settled = message.status === "done" || message.status === "stopped" || message.status === "error";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sin portapapeles: nada que avisar.
    }
  };

  const toggleReading = () => {
    if (reading) {
      stopReading.current();
      setReading(false);
      return;
    }
    setReading(true);
    stopReading.current = speak(message.text, lang, () => setReading(false));
  };

  return (
    <div className="group/agent flex items-start gap-3" data-testid="chat-agent" data-status={message.status}>
      <ChatMark size="sm" className="mt-1" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {message.status === "error" ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <Text size="sm" tone="negative">
              {t("chat.error")}
            </Text>
            {onRegenerate && (
              <Button type="button" variant="outline" size="sm" onClick={onRegenerate}>
                {t("common.retry")}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div aria-label={t("chat.agentMessage")} className={cn(streaming && !done && "chat-caret")}>
              <ChatMarkdown text={shown} onNavigate={onNavigate} />
            </div>
            {/* Lo que se lee de una vez, para quien escucha: el texto entero cuando terminó. */}
            {finished && message.status === "done" && (
              <span className="sr-only" role="status">
                {message.text}
              </span>
            )}
          </>
        )}

        {streaming && !done && (
          <Button type="button" variant="outline" size="sm" className="self-start rounded-full" onClick={() => onStop(shownRef.current)}>
            <ThemaIcon className="text-current" name="stop" size="xs" decorative />
            {t("chat.stop")}
          </Button>
        )}

        {message.status === "stopped" && (
          <Text size="xs" tone="muted">
            {t("chat.stopped")}
          </Text>
        )}

        {settled && message.card && <ChatCardView card={message.card} />}

        {settled &&
          message.actions?.map((action) => (
            <ChatActionCard
              key={action.id}
              action={action}
              onApply={onAction ? () => onAction(action, "apply") : undefined}
              onUndo={onAction ? () => onAction(action, "undo") : undefined}
              onDiscard={onDiscardAction ? () => onDiscardAction(action.id) : undefined}
              onNavigate={onNavigate}
            />
          ))}

        {settled && message.question && <ChatQuestionCard question={message.question} active={isLast} onAnswer={onAnswer} />}

        {settled && message.link && (
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onNavigate?.(message.link!.href)}>
            {message.link.label}
            <ThemaIcon className="text-current" name="arrowRight" size="xs" decorative />
          </Button>
        )}

        {settled && message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Text size="xs" tone="muted" className="mr-1">
              {t("chat.sources")}
            </Text>
            {message.sources.map((source) => (
              <HoverCard key={source.label} openDelay={200}>
                <HoverCardTrigger asChild>
                  <span className="inline-flex cursor-default items-center gap-1 rounded-full border border-border/70 bg-surface px-2 py-0.5 text-xs text-text-secondary">
                    <ThemaIcon name="file" size="xs" tone="muted" decorative />
                    {source.label}
                  </span>
                </HoverCardTrigger>
                <HoverCardContent side="top" className="w-64 text-xs">
                  {source.detail && <p className="mb-1 font-medium text-text-primary">{source.detail}</p>}
                  <p className="text-text-muted">{t("chat.sourcesHint")}</p>
                </HoverCardContent>
              </HoverCard>
            ))}
          </div>
        )}

        {settled && message.status !== "error" && (
          <div
            className={cn("flex items-center gap-0.5 transition-opacity", !isLast && "opacity-0 group-hover/agent:opacity-100 focus-within:opacity-100")}
            data-testid="chat-agent-actions"
          >
            <ActionButton label={copied ? t("chat.copied") : t("chat.copy")} name={copied ? "check" : "copy"} onClick={copy} />
            <ActionButton
              label={t("chat.useful")}
              name="thumbsUp"
              active={message.feedback === "up"}
              onClick={() => {
                setAskingWhy(false);
                onFeedback(message.feedback === "up" ? undefined : "up");
              }}
            />
            <ActionButton
              label={t("chat.notUseful")}
              name="thumbsDown"
              active={message.feedback === "down"}
              onClick={() => {
                const next = message.feedback === "down" ? undefined : "down";
                onFeedback(next);
                setAskingWhy(next === "down");
              }}
            />
            {onRegenerate && isLast && <ActionButton label={t("chat.regenerate")} name="refresh" onClick={onRegenerate} />}
            <ActionButton label={reading ? t("chat.stopReading") : t("chat.readAloud")} name={reading ? "stop" : "volume"} active={reading} onClick={toggleReading} />
            {onMore && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("chat.more")}
                    title={t("chat.more")}
                    className="flex size-7 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <ThemaIcon className="text-current" name="more" size="xs" decorative />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="rounded-xl">
                  <DropdownMenuItem onSelect={() => onMore("share")} className="gap-2">
                    <ThemaIcon className="text-current" name="share" size="xs" decorative />
                    {t("chat.shareMessage")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onMore("task")} className="gap-2">
                    <ThemaIcon className="text-current" name="task" size="xs" decorative />
                    {t("chat.createTask")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onMore("report")} className="gap-2">
                    <ThemaIcon className="text-current" name="flag" size="xs" decorative />
                    {t("chat.report")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        {askingWhy && <ChatFeedbackForm onSubmit={(detail) => onFeedback("down", detail)} onCancel={() => setAskingWhy(false)} />}

        {isLast && message.status === "done" && finished && message.followups && message.followups.length > 0 && !message.question && (
          <div className="chat-rise flex flex-wrap gap-2" aria-label={t("chat.followups")} data-testid="chat-followups">
            {message.followups.map((followup) => (
              <Chip key={followup} label={followup} icon="sparkles" size="md" onClick={() => onFollowup(followup)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
