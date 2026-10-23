import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import { Text } from "@/components/typography";

export interface ChatIdeasProps {
  ideas: readonly string[];
  onPick: (idea: string) => void;
  /** Una columna (celular, panel estrecho) o de a dos. */
  columns?: 1 | 2;
  className?: string;
}

/**
 * Las ideas para empezar de la portada de Clipper: tarjetas numeradas debajo de la caja, que se
 * tocan una vez y arrancan la conversación. En celular van una debajo de otra.
 */
export function ChatIdeas({ ideas, onPick, columns = 2, className }: ChatIdeasProps) {
  const t = useT();
  if (ideas.length === 0) return null;
  return (
    <ol aria-label={t("chat.ideas")} className={cn("grid grid-cols-1 gap-2", columns === 2 && "sm:grid-cols-2", className)} data-testid="chat-ideas">
      {ideas.map((idea, index) => (
        <li key={idea}>
          <button
            type="button"
            onClick={() => onPick(idea)}
            className="group flex h-full w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left outline-none transition-colors duration-fast hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border font-mono text-xs text-text-secondary transition-colors group-hover:border-primary/60 group-hover:text-primary">
              {index + 1}
            </span>
            <Text as="span" size="sm" weight="semibold" className="min-w-0 line-clamp-2">
              {idea}
            </Text>
          </button>
        </li>
      ))}
    </ol>
  );
}
