import type { ChatAction, ChatBackend, ChatMessage, ChatReply, ChatState, Conversation } from "./types";

/**
 * Las conversaciones, en un solo sitio.
 *
 * El panel lateral, la pantalla completa, el historial de la barra lateral
 * y el modo voz miran el mismo almacén: una pregunta hecha en el panel
 * aparece en el historial y se puede seguir en pantalla completa. Se guarda
 * en el navegador para que no se pierda al recargar.
 *
 * Es un almacén externo (`subscribe` + `getState`), sin React dentro, para
 * poder probarlo solo y usarlo desde `useSyncExternalStore`.
 */

export interface ChatPersistence {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
}

export interface ChatStoreOptions {
  storageKey?: string;
  persistence?: ChatPersistence | null;
  now?: () => number;
  makeId?: () => string;
}

/** Lo que se muestra como título mientras la conversación no tiene uno mejor. */
const TITLE_LENGTH = 60;

function titleFrom(text: string): string {
  const line = text.trim().split("\n")[0] ?? "";
  return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1).trimEnd()}…` : line;
}

function defaultId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function localStoragePersistence(): ChatPersistence | null {
  if (typeof window === "undefined") return null;
  return {
    get: (key) => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Sin almacenamiento (ventana privada, bloqueado): la conversación vive mientras dure la pestaña.
      }
    },
  };
}

/** Al recuperar, una respuesta que se quedó esperando ya no va a llegar. */
function settle(conversation: Conversation): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.map((message) =>
      message.status === "pending" ? { ...message, status: "error" } : message.status === "streaming" ? { ...message, status: "done" } : message
    ),
  };
}

function isConversationList(value: unknown): value is Conversation[] {
  return Array.isArray(value) && value.every((item) => item && typeof item === "object" && typeof item.id === "string" && Array.isArray(item.messages));
}

export function createChatStore(options: ChatStoreOptions = {}) {
  const storageKey = options.storageKey ?? "thema-chat";
  const persistence = options.persistence === undefined ? localStoragePersistence() : options.persistence;
  const now = options.now ?? (() => Date.now());
  const makeId = options.makeId ?? defaultId;
  const listeners = new Set<() => void>();
  /** Las respuestas en curso, para poder cancelarlas. */
  const inflight = new Map<string, AbortController>();

  let state: ChatState = { conversations: [], activeId: null };
  const raw = persistence?.get(storageKey);
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isConversationList(parsed)) state = { conversations: parsed.map(settle), activeId: null };
    } catch {
      // Un JSON roto no vale nada: se empieza de cero.
    }
  }

  const persist = () => persistence?.set(storageKey, JSON.stringify(state.conversations));

  const setState = (update: (previous: ChatState) => ChatState) => {
    state = update(state);
    persist();
    for (const listener of listeners) listener();
  };

  const patchConversation = (id: string, update: (conversation: Conversation) => Conversation) =>
    setState((previous) => ({
      ...previous,
      conversations: previous.conversations.map((conversation) => (conversation.id === id ? update(conversation) : conversation)),
    }));

  const patchMessage = (conversationId: string, messageId: string, update: (message: ChatMessage) => ChatMessage) =>
    patchConversation(conversationId, (conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) => (message.id === messageId ? update(message) : message)),
    }));

  const findConversation = (id: string | null) => state.conversations.find((conversation) => conversation.id === id);

  /** Pide la respuesta a `question` y la deja en el mensaje `messageId` cuando llegue. */
  const ask = (conversationId: string, messageId: string, question: string, backend: ChatBackend) => {
    const history = findConversation(conversationId)?.messages.filter((message) => message.id !== messageId) ?? [];
    const controller = new AbortController();
    inflight.set(messageId, controller);
    backend
      .reply(question, history, controller.signal)
      .then((reply: ChatReply) => {
        if (controller.signal.aborted) return;
        inflight.delete(messageId);
        patchMessage(conversationId, messageId, (message) => ({
          ...message,
          status: "streaming",
          text: reply.text,
          sources: reply.sources,
          followups: reply.followups,
          question: reply.question,
          card: reply.card,
          link: reply.link,
          actions: reply.actions,
          via: reply.via,
          traceId: reply.traceId,
        }));
        // Si no se está mirando esta conversación, la respuesta queda sin leer.
        patchConversation(conversationId, (conversation) => ({ ...conversation, updatedAt: now(), unread: state.activeId !== conversationId }));
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        inflight.delete(messageId);
        patchMessage(conversationId, messageId, (message) => ({ ...message, status: "error" }));
      });
  };

  const appendAgentPlaceholder = (conversationId: string, question: string, backend: ChatBackend) => {
    const agent: ChatMessage = { id: makeId(), role: "agent", text: "", createdAt: now(), status: "pending" };
    patchConversation(conversationId, (conversation) => ({ ...conversation, messages: [...conversation.messages, agent], updatedAt: now() }));
    ask(conversationId, agent.id, question, backend);
    return agent.id;
  };

  return {
    getState: () => state,
    setState,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Mirar una conversación (o `null` para una nueva). Mirarla la marca como leída. */
    setActive(id: string | null) {
      setState((previous) => ({
        activeId: id,
        conversations: previous.conversations.map((conversation) => (conversation.id === id ? { ...conversation, unread: false } : conversation)),
      }));
    },

    /**
     * Envía una pregunta a la conversación activa; si no hay, la crea con la
     * pregunta como título. Devuelve el id de la conversación.
     */
    send(text: string, backend: ChatBackend, conversationId: string | null = state.activeId): string {
      const trimmed = text.trim();
      const user: ChatMessage = { id: makeId(), role: "user", text: trimmed, createdAt: now(), status: "done" };
      let id = conversationId && findConversation(conversationId) ? conversationId : null;
      if (id) {
        patchConversation(id, (conversation) => ({ ...conversation, messages: [...conversation.messages, user], updatedAt: now() }));
      } else {
        id = makeId();
        const conversation: Conversation = { id, title: titleFrom(trimmed), createdAt: now(), updatedAt: now(), messages: [user], unread: false };
        setState((previous) => ({ activeId: id, conversations: [conversation, ...previous.conversations] }));
      }
      if (state.activeId !== id) setState((previous) => ({ ...previous, activeId: id }));
      appendAgentPlaceholder(id, trimmed, backend);
      return id;
    },

    /** Elegir una opción de una pregunta del agente: la deja respondida y la envía. */
    answer(messageId: string, option: string, backend: ChatBackend) {
      const conversation = state.conversations.find((item) => item.messages.some((message) => message.id === messageId));
      if (!conversation) return;
      patchMessage(conversation.id, messageId, (message) => (message.question ? { ...message, question: { ...message.question, answer: option } } : message));
      this.send(option, backend, conversation.id);
    },

    /** La persona detuvo la respuesta: se queda con lo que alcanzó a ver. */
    stop(messageId: string, shownText: string) {
      inflight.get(messageId)?.abort();
      inflight.delete(messageId);
      const conversation = state.conversations.find((item) => item.messages.some((message) => message.id === messageId));
      if (!conversation) return;
      patchMessage(conversation.id, messageId, (message) => ({ ...message, status: "stopped", text: shownText, followups: undefined, question: undefined }));
    },

    /** La respuesta terminó de escribirse en pantalla. */
    finish(messageId: string) {
      const conversation = state.conversations.find((item) => item.messages.some((message) => message.id === messageId));
      if (!conversation) return;
      patchMessage(conversation.id, messageId, (message) => (message.status === "streaming" ? { ...message, status: "done" } : message));
    },

    /** Vuelve a pedir la última respuesta de la conversación activa. */
    regenerate(backend: ChatBackend) {
      const conversation = findConversation(state.activeId);
      if (!conversation) return;
      const last = conversation.messages.at(-1);
      const lastUser = [...conversation.messages].reverse().find((message) => message.role === "user");
      if (!last || !lastUser) return;
      if (last.role === "agent") {
        inflight.get(last.id)?.abort();
        inflight.delete(last.id);
        patchConversation(conversation.id, (item) => ({ ...item, messages: item.messages.slice(0, -1) }));
      }
      appendAgentPlaceholder(conversation.id, lastUser.text, backend);
    },

    /** Corrige una pregunta: lo que venía después se descarta y se responde de nuevo. */
    edit(messageId: string, text: string, backend: ChatBackend) {
      const conversation = state.conversations.find((item) => item.messages.some((message) => message.id === messageId));
      if (!conversation) return;
      const index = conversation.messages.findIndex((message) => message.id === messageId);
      for (const message of conversation.messages.slice(index + 1)) inflight.get(message.id)?.abort();
      patchConversation(conversation.id, (item) => ({
        ...item,
        messages: [...item.messages.slice(0, index), { ...item.messages[index], text: text.trim() }],
      }));
      appendAgentPlaceholder(conversation.id, text.trim(), backend);
    },

    /** Cambia el estado de un cambio propuesto (aplicado, descartado, deshecho…). */
    updateAction(messageId: string, actionId: string, patch: Partial<ChatAction>) {
      const conversation = state.conversations.find((item) => item.messages.some((message) => message.id === messageId));
      if (!conversation) return;
      patchMessage(conversation.id, messageId, (message) => ({ ...message, actions: message.actions?.map((action) => (action.id === actionId ? { ...action, ...patch } : action)) }));
    },

    feedback(messageId: string, value: "up" | "down" | undefined) {
      const conversation = state.conversations.find((item) => item.messages.some((message) => message.id === messageId));
      if (!conversation) return;
      patchMessage(conversation.id, messageId, (message) => ({ ...message, feedback: value }));
    },

    rename(id: string, title: string) {
      patchConversation(id, (conversation) => ({ ...conversation, title }));
    },

    remove(id: string) {
      for (const message of findConversation(id)?.messages ?? []) inflight.get(message.id)?.abort();
      setState((previous) => ({
        activeId: previous.activeId === id ? null : previous.activeId,
        conversations: previous.conversations.filter((conversation) => conversation.id !== id),
      }));
    },

    clear() {
      for (const controller of inflight.values()) controller.abort();
      inflight.clear();
      setState(() => ({ conversations: [], activeId: null }));
    },
  };
}

export type ChatStore = ReturnType<typeof createChatStore>;
