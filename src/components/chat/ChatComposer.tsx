import * as React from "react";
import { cn } from "@/lib/utils";
import { ThemaIcon } from "@/icons/ThemaIcon";
import { MovingBorderBeam } from "@/components/ui/moving-border-beam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Chip } from "@/components/ai-interaction/Chip";
import { Text } from "@/components/typography";
import { useT } from "@/i18n";
import { ChatAttachMenu } from "./ChatAttachMenu";
import type { ChatConnector, ChatNews } from "./useChat";
import "./chat.css";

export interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  /** Se llama con el texto ya recortado y los archivos adjuntos; la caja se vacía sola. */
  onSend: (text: string, files: readonly File[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Una fila y menos aire: para el pie de un hilo. */
  compact?: boolean;
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLTextAreaElement>;
  /** El aviso de novedad encima del texto («Nuevo · Ya ejecuta acciones en…»). */
  news?: ChatNews;
  /** El objeto sobre el que responde el agente, como pastilla. */
  contextChip?: string;
  onRemoveContext?: () => void;
  /** El menú «+»; apagado no hay botón. */
  attach?: boolean;
  /**
   * Qué se adjunta: `files` (el menú «+» con conectores y documentos) o `photos`
   * (un botón de imagen que abre la galería o la cámara; se ven en miniatura).
   */
  attachKind?: "files" | "photos";
  connectors?: readonly ChatConnector[];
  onToggleConnector?: (id: string, connected: boolean) => void;
  onAddConnectors?: () => void;
  /** El botón «Voz»; sin `onVoice` no se muestra. */
  onVoice?: () => void;
  /** Preguntas para arrancar, como chips encima de la caja. */
  chips?: readonly string[];
  onChip?: (text: string) => void;
  /** «El agente puede cometer errores…» debajo. */
  disclaimer?: boolean;
  maxFiles?: number;
  maxSizeMb?: number;
  className?: string;
}

const MB = 1024 * 1024;

/** `**negrita**` en una línea, sin montar Markdown entero. */
function InlineBold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") ? (
          <strong key={index} className="font-semibold text-text-primary">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

/** Un adjunto antes de enviarlo: la foto en miniatura o, si no es imagen, su nombre. */
function PendingFile({ file, onRemove }: { file: File; onRemove: () => void }) {
  const t = useT();
  const isImage = file.type.startsWith("image/");
  const imageRef = React.useRef<HTMLImageElement>(null);
  // La URL se crea y se libera con el efecto (en modo estricto se monta dos veces: cada vez la suya).
  React.useEffect(() => {
    const node = imageRef.current;
    if (!node || typeof URL.createObjectURL !== "function") return;
    const url = URL.createObjectURL(file);
    node.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const remove = (
    <button type="button" aria-label={t("chat.attachmentRemove")} onClick={onRemove} className="rounded-full p-0.5 text-text-muted hover:text-text-primary">
      <ThemaIcon className="text-current" name="close" size="xs" decorative />
    </button>
  );
  if (isImage) {
    return (
      <li className="relative">
        <img ref={imageRef} alt={file.name} className="size-14 rounded-lg border border-border/70 bg-surface-muted object-cover" />
        <span className="absolute -right-1.5 -top-1.5 rounded-full bg-surface shadow-sm">{remove}</span>
      </li>
    );
  }
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface-muted py-1 pl-2.5 pr-1 text-xs text-text-primary">
      <ThemaIcon name="file" size="xs" tone="muted" decorative />
      <span className="max-w-40 truncate">{file.name}</span>
      {remove}
    </li>
  );
}

/**
 * La caja de escribir del chat.
 *
 * Es la misma en el panel, en la pantalla completa y al terminar el modo
 * voz: el borde que recorre y la malla se encienden al enfocar, Enter envía
 * y Shift+Enter baja de línea, el «+» trae conectores y archivos (⌘U), y el
 * botón de enviar lleva un halo que se enciende cuando hay algo que enviar.
 */
export function ChatComposer({
  value,
  onChange,
  onSend,
  placeholder,
  disabled = false,
  compact = false,
  autoFocus = false,
  inputRef,
  news,
  contextChip,
  onRemoveContext,
  attach = true,
  attachKind = "files",
  connectors,
  onToggleConnector,
  onAddConnectors,
  onVoice,
  chips,
  onChip,
  disclaimer = true,
  maxFiles = 10,
  maxSizeMb = 25,
  className,
}: ChatComposerProps) {
  const t = useT();
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [files, setFiles] = React.useState<readonly File[]>([]);
  const [newsDismissed, setNewsDismissed] = React.useState(false);
  const trimmed = value.trim();
  const canSend = !disabled && (trimmed.length > 0 || files.length > 0);

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed, files);
    onChange("");
    setFiles([]);
  };

  const pickFiles = () => fileInput.current?.click();

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const accepted = Array.from(list).filter((file) => file.size <= maxSizeMb * MB && (attachKind !== "photos" || file.type.startsWith("image/")));
    setFiles((previous) => [...previous, ...accepted].slice(0, maxFiles));
  };

  const showNews = news && !newsDismissed;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="chat-chips">
          {chips.map((chip) => (
            <Chip key={chip} label={chip} size="md" onClick={() => onChip?.(chip)} />
          ))}
        </div>
      )}

      <div
        className="chat-composer group relative isolate overflow-hidden rounded-[22px] border border-border/60 bg-surface shadow-card transition-shadow focus-within:shadow-lg"
        onKeyDown={(event) => {
          if (attach && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "u") {
            event.preventDefault();
            pickFiles();
          }
        }}
        data-testid="chat-composer"
      >
        <MovingBorderBeam duration={6000} borderWidth={1.5} rx={22} ry={22} colorFrom="hsl(var(--ai-gradient-start))" colorTo="hsl(var(--ai-gradient-end))" />
        <div aria-hidden className="chat-composer-wash pointer-events-none absolute inset-0 z-0" />

        <div className="relative z-10 flex flex-col">
          {showNews && (
            <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2" data-testid="chat-news">
              <ThemaIcon name="magicWand" size="xs" tone="muted" decorative />
              <Badge className="rounded-full">{t("chat.new")}</Badge>
              <Text size="sm" tone="secondary" className="min-w-0 flex-1 truncate">
                <InlineBold text={news.text} />
              </Text>
              {news.onOpen && (
                <button type="button" onClick={news.onOpen} className="shrink-0 text-sm font-medium text-primary hover:underline">
                  {t("chat.newsSeeWhatChanged")}
                </button>
              )}
              <button
                type="button"
                aria-label={t("chat.newsDismiss")}
                onClick={() => {
                  setNewsDismissed(true);
                  news.onDismiss?.();
                }}
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border/70 text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
              >
                <ThemaIcon className="text-current" name="close" size="xs" decorative />
              </button>
            </div>
          )}

          {contextChip && (
            <div className="flex items-center gap-2 border-b border-border/50 bg-surface-muted/50 px-4 py-2">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 py-0.5 pl-2 pr-1 text-xs font-medium text-text-primary">
                <ThemaIcon name="sparkles" size="xs" tone="primary" decorative />
                <span className="truncate">{contextChip}</span>
                {onRemoveContext && (
                  <button type="button" aria-label={t("chat.contextRemove")} onClick={onRemoveContext} className="rounded-full p-0.5 text-text-muted hover:text-text-primary">
                    <ThemaIcon className="text-current" name="close" size="xs" decorative />
                  </button>
                )}
              </span>
              <Text size="xs" tone="muted" className="truncate">
                {t("chat.contextNote")}
              </Text>
            </div>
          )}

          {files.length > 0 && (
            <ul className="flex flex-wrap gap-2 px-4 pt-3" aria-label={t("chat.attachFiles")}>
              {files.map((file, index) => (
                <PendingFile key={`${file.name}-${index}`} file={file} onRemove={() => setFiles((previous) => previous.filter((_, position) => position !== index))} />
              ))}
            </ul>
          )}

          <textarea
            ref={inputRef}
            rows={compact ? 1 : 2}
            value={value}
            disabled={disabled}
            autoFocus={autoFocus}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder ?? t("chat.placeholder.new")}
            aria-label={t("chat.messageLabel")}
            data-testid="chat-input"
            className={cn(
              "w-full resize-none bg-transparent px-4 text-base leading-normal text-text-primary outline-none placeholder:text-text-muted disabled:opacity-60",
              compact ? "min-h-8 pb-1 pt-3 text-sm" : "min-h-16 pb-2 pt-4"
            )}
          />

          <div className="flex items-center justify-between gap-3 px-3 pb-3">
            <div className="flex items-center gap-2">
              {attach && (
                <>
                  {attachKind === "photos" ? (
                    <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" onClick={pickFiles} disabled={disabled || files.length >= maxFiles} aria-label={t("chat.attachPhotos")} data-testid="chat-attach-photos">
                      <ThemaIcon name="image" />
                    </Button>
                  ) : (
                    <ChatAttachMenu
                      connectors={connectors}
                      onToggleConnector={onToggleConnector}
                      onAddConnectors={onAddConnectors}
                      onPickFiles={pickFiles}
                      maxFiles={maxFiles}
                      maxSizeMb={maxSizeMb}
                      disabled={disabled}
                    />
                  )}
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    accept={attachKind === "photos" ? "image/*" : ".pdf,.xls,.xlsx,.csv"}
                    aria-label={attachKind === "photos" ? t("chat.attachPhotos") : t("chat.attachFiles")}
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(event) => {
                      addFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </>
              )}
              {!compact && (
                <Text size="xs" tone="muted" className="inline-flex items-center gap-1.5 max-sm:hidden">
                  <Kbd size="sm">Enter</Kbd>
                  {t("chat.enterToSend")}
                </Text>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onVoice && (
                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onVoice} disabled={disabled} data-testid="chat-voice">
                  <ThemaIcon className="text-current" name="audioWave" size="xs" decorative />
                  {t("chat.voice")}
                </Button>
              )}
              <span className="relative inline-flex">
                <span aria-hidden className={cn("chat-send-halo", canSend && "chat-send-halo--on")} />
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSend}
                  aria-label={t("chat.send")}
                  data-testid="chat-send"
                  className="relative flex size-9 items-center justify-center rounded-full bg-ai-gradient text-text-inverse transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40"
                >
                  <ThemaIcon className="text-current" name="send" size="sm" decorative />
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>

      {disclaimer && (
        <Text size="xs" tone="muted" className="text-center">
          {t("chat.disclaimer")}
        </Text>
      )}
    </div>
  );
}
