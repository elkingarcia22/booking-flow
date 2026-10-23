import { cn } from "@/lib/utils";
import { ThemaIcon } from "@/icons/ThemaIcon";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/typography";
import { useT } from "@/i18n";
import type { ChatAction } from "@/lib/chat";
import "./chat.css";

export interface ChatActionCardProps {
  action: ChatAction;
  /** Sin esto (nadie sabe ejecutarla) la tarjeta solo muestra la propuesta. */
  onApply?: () => void;
  onDiscard?: () => void;
  onUndo?: () => void;
  onNavigate?: (href: string) => void;
}

const STATUS_KEYS = {
  proposed: "chat.action.proposed",
  applying: "chat.action.applying",
  applied: "chat.action.applied",
  discarded: "chat.action.discarded",
  undoing: "chat.action.undoing",
  undone: "chat.action.undone",
  failed: "chat.action.failed",
} as const;

/**
 * Un cambio que propuso el agente: qué cambia (antes tachado, después), los avisos y «Aplicar». Nada
 * se toca hasta que la persona lo aplica; aplicado, queda «Deshacer» y el enlace para verlo.
 */
export function ChatActionCard({ action, onApply, onDiscard, onUndo, onNavigate }: ChatActionCardProps) {
  const t = useT();
  const busy = action.status === "applying" || action.status === "undoing";
  const closed = action.status === "discarded" || action.status === "undone";
  return (
    <section
      aria-label={action.title}
      className={cn("chat-rise flex flex-col gap-3 rounded-2xl border bg-surface p-4 shadow-card", action.status === "applied" ? "border-status-positive/40" : action.status === "failed" ? "border-destructive/40" : "border-border/70", closed && "opacity-70")}
      data-testid="chat-action"
      data-status={action.status}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <Text size="sm" weight="semibold">
          {action.title}
        </Text>
        <Text size="xs" tone={action.status === "applied" ? "positive" : action.status === "failed" ? "negative" : "muted"} className="shrink-0">
          {t(STATUS_KEYS[action.status])}
        </Text>
      </div>
      <dl className="flex flex-col gap-1.5 text-sm">
        {action.rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[minmax(0,7rem)_1fr] sm:gap-3">
            <dt className="text-xs text-text-muted sm:text-sm">{row.label}</dt>
            <dd className="min-w-0 text-text-primary">
              {row.before !== undefined && row.before !== row.after && (
                <>
                  <span className="text-text-muted line-through">{row.before}</span>
                  <ThemaIcon name="arrowRight" size="xs" tone="muted" decorative className="mx-1.5 inline-block align-middle" />
                </>
              )}
              <span className={cn(row.before !== undefined && row.before !== row.after && "font-medium")}>{row.after}</span>
            </dd>
          </div>
        ))}
      </dl>
      {action.warnings && action.warnings.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-xl bg-status-warning/10 px-3 py-2 text-xs text-text-primary">
          {action.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      {action.error && (
        <Text size="xs" tone="negative" role="alert">
          {action.error}
        </Text>
      )}
      {(action.status === "proposed" || action.status === "failed" || action.status === "applying") && onApply && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onApply} disabled={busy} data-testid="chat-action-apply">
            {action.status === "failed" ? t("common.retry") : t("chat.action.apply")}
          </Button>
          {onDiscard && (
            <Button type="button" size="sm" variant="ghost" onClick={onDiscard} disabled={busy}>
              {t("chat.action.discard")}
            </Button>
          )}
        </div>
      )}
      {(action.status === "applied" || action.status === "undoing") && (
        <div className="flex flex-wrap gap-2">
          {onUndo && action.undo && (
            <Button type="button" size="sm" variant="outline" onClick={onUndo} disabled={busy} data-testid="chat-action-undo">
              {t("chat.action.undo")}
            </Button>
          )}
          {action.href && onNavigate && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onNavigate(action.href!)}>
              {t("chat.action.open")}
              <ThemaIcon className="text-current" name="arrowRight" size="xs" decorative />
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
