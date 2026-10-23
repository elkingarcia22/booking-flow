import type { ChatBackend, ChatMessage, ChatReply } from "./types";

/**
 * De qué está hablando el agente cuando una pantalla lo abre con algo en la
 * mano: una cita, un cliente. La pantalla deja aquí el foco y la app abre el
 * panel de Clipper con él; mientras dure, las preguntas las contesta primero
 * `answer` (lo que se sabe de esa cosa) y, si no sabe, quien responde de
 * siempre (la ayuda).
 *
 * Vive fuera de React para que cualquier pantalla lo pida sin que la app le
 * pase nada: la pantalla pone el foco y el shell, suscrito, abre el panel.
 */

export interface AgentFocus {
  /** Qué se mira, para el subtítulo del panel: «Cita de Marcela · 7:00 p. m.». */
  title: string;
  /** Las ideas de la portada y las preguntas para seguir. */
  suggestions: readonly string[];
  /** Lo primero que se le pregunta al abrir, para que el panel llegue con algo dicho. */
  opening?: string;
  /** La respuesta sobre lo que se mira; `null` deja la pregunta a quien responde siempre. */
  answer: (question: string, history: readonly ChatMessage[]) => ChatReply | null;
}

interface AgentFocusState {
  focus: AgentFocus | null;
  /** Cambia en cada petición de abrir, aunque el foco sea el mismo. */
  request: number;
}

let state: AgentFocusState = { focus: null, request: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const agentFocus = {
  /** Abre el panel de Clipper hablando de esto. */
  open(focus: AgentFocus): void {
    state = { focus, request: state.request + 1 };
    emit();
  },
  /** Deja de hablar de lo que se miraba (al cerrar el panel). */
  clear(): void {
    if (!state.focus) return;
    state = { ...state, focus: null };
    emit();
  },
  getState: (): AgentFocusState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** Lo que tarda en «pensar» una respuesta sabida, para que no aparezca de golpe. */
const FOCUS_THINK_MS = 450;

/** Quien responde con un foco puesto: primero lo que se sabe de lo que se mira, luego el de siempre. */
export function withAgentFocus(base: ChatBackend, focus: AgentFocus): ChatBackend {
  return {
    async reply(question, history, signal) {
      const known = focus.answer(question, history);
      if (!known) return base.reply(question, history, signal);
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(resolve, FOCUS_THINK_MS);
        signal.addEventListener("abort", () => {
          window.clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
      return known;
    },
  };
}
