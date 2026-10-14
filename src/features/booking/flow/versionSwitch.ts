import * as React from "react";

/**
 * Pasar a la Conversación desde otra experiencia (Paso a paso, Agenda): quien prefiere
 * escribir lo que quiere lo hace sin buscar otra página. `null` donde no se ofrece.
 */
const SwitchToChatContext = React.createContext<(() => void) | null>(null);

export const SwitchToChatProvider = SwitchToChatContext.Provider;

export const useSwitchToChat = (): (() => void) | null => React.useContext(SwitchToChatContext);

/**
 * «Agenda con Clipper» desde otra experiencia: Clipper abre con la voz ya escuchando y saluda según de
 * dónde viene (Paso a paso pide quién eres; la Agenda pregunta qué quieres hacer). La
 * experiencia se monta de nuevo al cambiar, así que el aviso se deja aquí y lo lee Clipper al abrir.
 */
let voiceOnArrival: string | null = null;

export const requestVoiceOnArrival = (origin: string) => {
  voiceOnArrival = origin;
};

/** De qué experiencia se llegó con la voz pedida, o `null`. */
export const peekVoiceOnArrival = (): string | null => voiceOnArrival;

export const clearVoiceOnArrival = () => {
  voiceOnArrival = null;
};
