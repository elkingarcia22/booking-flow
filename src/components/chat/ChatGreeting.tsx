import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import { Heading, Text } from "@/components/typography";
import { ChatMark } from "./ChatMark";
import { greetingKey } from "./greeting";
import "./chat.css";

export interface ChatGreetingProps {
  name: string;
  /** `panel` es más pequeño y sin marca; `screen` es la portada de Clipper: orbe, nombre, saludo y una línea. */
  variant?: "panel" | "screen";
  className?: string;
}

/** El arranque de una conversación nueva: el orbe de Clipper y «¡Buenos días, Carolina!». */
export function ChatGreeting({ name, variant = "screen", className }: ChatGreetingProps) {
  const t = useT();
  const firstName = name.split(" ")[0] ?? name;
  if (variant === "panel") {
    return (
      <div className={cn("chat-rise flex flex-col items-center text-center", className)}>
        <p className="text-xl font-semibold tracking-tight text-text-primary">
          <span className="text-ai-gradient">{t(greetingKey())}</span> {firstName}!
        </p>
      </div>
    );
  }
  return (
    <div className={cn("chat-rise flex flex-col items-center gap-5 text-center", className)}>
      <ChatMark size="lg" motion="breathing" />
      <div className="flex flex-col items-center gap-2">
        <Text as="span" size="sm" weight="semibold" className="text-ai-gradient tracking-wide">
          {t("chat.title")}
        </Text>
        <Heading level={2}>
          {t(greetingKey())} {firstName}!
        </Heading>
        <Text tone="secondary">{t("chat.screenLead")}</Text>
      </div>
    </div>
  );
}
