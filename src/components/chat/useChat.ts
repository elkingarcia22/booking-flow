import * as React from "react";
import type { ChatAction, ChatBackend, ChatMessage, ChatState, ChatStore, Conversation } from "@/lib/chat";
import type { ChatFeedbackPayload } from "./ChatFeedbackForm";

export interface ChatConnector {
  id: string;
  label: string;
  connected: boolean;
}

export interface ChatNews {
  /** «Ya ejecuta acciones en **Selección**.» El Markdown ligero vale. */
  text: string;
  onOpen?: () => void;
  onDismiss?: () => void;
}

export interface ChatContextValue {
  store: ChatStore;
  backend: ChatBackend;
  /** Quien pregunta; su nombre va en el saludo. */
  user: { name: string };
  /** BCP 47 para la voz: `es-CO`, `en-US`. */
  lang: string;
  /** Enlaces internos de una respuesta. */
  onNavigate?: (href: string) => void;
  /** Preguntas para arrancar una conversación nueva. */
  suggestions?: readonly string[];
  connectors?: readonly ChatConnector[];
  onToggleConnector?: (id: string, connected: boolean) => void;
  onAddConnectors?: () => void;
  news?: ChatNews;
  /** Abrir la conversación en pantalla completa; sin esto el panel no ofrece el botón. */
  onOpenFull?: (conversationId: string | null) => void;
  /** Abrir el modo voz; sin esto no hay botón Voz. */
  onOpenVoice?: () => void;
  /**
   * Aplicar o deshacer un cambio que propuso el agente. Devuelve cómo queda (`applied` con su `undo`,
   * `undone`); si falla, lanza un error con el mensaje para la persona. Sin esto, las propuestas no
   * tienen botón.
   */
  onAction?: (action: ChatAction, op: "apply" | "undo") => Promise<Partial<ChatAction>>;
  /** El 👍/👎 de una respuesta, con los motivos si los dio: para que quien respondió aprenda. */
  onFeedback?: (message: ChatMessage, value: "up" | "down" | undefined, detail?: ChatFeedbackPayload) => void;
}

export const ChatContext = React.createContext<ChatContextValue | null>(null);

export function useChatContext(): ChatContextValue {
  const value = React.useContext(ChatContext);
  if (!value) throw new Error("useChatContext: falta <ChatProvider> por encima.");
  return value;
}

/** El estado del almacén, suscrito. */
export function useChatState(): ChatState {
  const { store } = useChatContext();
  return React.useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/** La conversación activa, o `null` si es nueva. */
export function useActiveConversation(): Conversation | null {
  const state = useChatState();
  return state.conversations.find((conversation) => conversation.id === state.activeId) ?? null;
}

/** Las acciones del chat, ya atadas al almacén y a quien responde. */
export function useChatActions() {
  const { store, backend, onAction, onFeedback } = useChatContext();
  return React.useMemo(
    () => ({
      /** Aplica o deshace un cambio propuesto; el estado va quedando en el mensaje. */
      runAction: async (messageId: string, action: ChatAction, op: "apply" | "undo") => {
        if (!onAction) return;
        store.updateAction(messageId, action.id, { status: op === "apply" ? "applying" : "undoing", error: undefined });
        try {
          store.updateAction(messageId, action.id, await onAction(action, op));
        } catch (error) {
          store.updateAction(messageId, action.id, { status: op === "apply" ? "failed" : "applied", error: error instanceof Error ? error.message : String(error) });
        }
      },
      discardAction: (messageId: string, actionId: string) => store.updateAction(messageId, actionId, { status: "discarded" }),
      send: (text: string) => store.send(text, backend),
      answer: (messageId: string, option: string) => store.answer(messageId, option, backend),
      regenerate: () => store.regenerate(backend),
      edit: (messageId: string, text: string) => store.edit(messageId, text, backend),
      stop: store.stop,
      finish: store.finish,
      feedback: (messageId: string, value: "up" | "down" | undefined, detail?: ChatFeedbackPayload) => {
        store.feedback(messageId, value);
        const message = store.getState().conversations.flatMap((conversation) => conversation.messages).find((item) => item.id === messageId);
        if (message) onFeedback?.(message, value, detail);
      },
      setActive: store.setActive,
      remove: store.remove,
      newConversation: () => store.setActive(null),
    }),
    [store, backend, onAction, onFeedback]
  );
}
