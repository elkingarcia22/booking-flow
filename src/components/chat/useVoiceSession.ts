import * as React from "react";
import { createRecognizer, isSpeechRecognitionSupported, speak, type ChatReply, type Recognizer } from "@/lib/chat";

export type VoiceStatus = "listening" | "paused" | "thinking" | "speaking" | "answered" | "unsupported" | "denied";

export interface VoiceSessionOptions {
  open: boolean;
  lang: string;
  ask: (text: string) => Promise<ChatReply>;
  /** Cuánto silencio, tras oír algo, cuenta como «ya terminé». */
  silenceMs?: number;
  /**
   * Conversación: la respuesta se dice en voz alta (voz de hombre, la de Clipper) y al terminar
   * vuelve a escuchar solo, como una llamada. Sin esto, la respuesta se queda escrita y en pausa.
   */
  conversation?: boolean;
  /**
   * Lo primero que dice el asistente al abrir (el saludo), antes de escuchar: así no se oye a sí
   * mismo y la conversación empieza como una llamada. Solo en conversación.
   */
  opening?: () => Promise<ChatReply>;
}

const DEFAULT_SILENCE_MS = 1600;
/** Si la frase no está cerrada (aún no es definitiva) se espera más; si termina en «con», «a las»…, más aún. */
const OPEN_PHRASE_FACTOR = 1.5;
const UNFINISHED_PHRASE_FACTOR = 2;
const UNFINISHED_ENDING = /\b(con|y|o|a|al|las|la|el|los|de|del|para|por|que|en|mi|un|una|unos|the|and|or|with|at|for|to|my|an?)$/i;
/** Cortes seguidos del reconocedor (red, audio) que se reintentan antes de dejarlo en pausa. */
const MAX_RETRIES = 3;

/**
 * Una sesión de voz: escucha, entiende que la persona hizo una pausa, pide
 * la respuesta y la deja lista para leer. Si el navegador no puede escuchar
 * lo dice, y el modo voz enseña lo mismo con el teclado.
 */
export function useVoiceSession({ open, lang, ask, silenceMs = DEFAULT_SILENCE_MS, conversation = false, opening }: VoiceSessionOptions) {
  // Nace escuchando: la sesión se monta al abrir el modo voz y se desmonta al cerrarlo.
  const [status, setStatusState] = React.useState<VoiceStatus>(() => (conversation && opening ? "thinking" : isSpeechRecognitionSupported() ? "listening" : "unsupported"));
  const [transcript, setTranscript] = React.useState("");
  const [interim, setInterim] = React.useState("");
  const [reply, setReply] = React.useState<ChatReply | null>(null);
  const [seconds, setSeconds] = React.useState(0);
  /** Cuenta las palabras que va diciendo Clipper: cada una mueve las ondas. */
  const [spokenWords, setSpokenWords] = React.useState(0);
  const recognizer = React.useRef<Recognizer | null>(null);
  const stopSpeaking = React.useRef<(() => void) | null>(null);
  /** Tras hablar, vuelve a escuchar; lo llena el efecto de abajo (se declara después). */
  const resumeRef = React.useRef<() => void>(() => {});
  const silence = React.useRef<number | null>(null);
  const statusRef = React.useRef(status);
  const askRef = React.useRef(ask);
  const openingRef = React.useRef(conversation ? opening : undefined);
  /** El saludo se dice una vez por sesión (en desarrollo React monta los efectos dos veces). */
  const greeted = React.useRef(false);
  React.useEffect(() => {
    askRef.current = ask;
  });
  // El estado se apunta en el acto: el reconocedor, al cortarse, mira si seguía escuchando para
  // retomarse, y si leyera el estado del render anterior se retomaría mientras Clipper piensa o habla.
  const setStatus = React.useCallback((next: VoiceStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  const clearSilence = () => {
    if (silence.current) window.clearTimeout(silence.current);
    silence.current = null;
  };

  /**
   * Cada reconocedor tiene su turno. Al dejar de escuchar (para contestar, en pausa o al cerrar) el
   * turno cambia: lo que el reconocedor anterior entregue tarde —Chrome suelta el final de lo que oyó
   * aunque se le haya parado— ya no cuenta, y no se pregunta dos veces lo mismo.
   */
  const turn = React.useRef(0);
  const retries = React.useRef(0);
  const stopListening = React.useCallback(() => {
    turn.current += 1;
    if (silence.current) window.clearTimeout(silence.current);
    silence.current = null;
    recognizer.current?.stop();
  }, []);

  /** La respuesta (o el saludo) en camino: se piensa, se dice en voz alta y se vuelve a escuchar. */
  const respond = React.useCallback((pending: Promise<ChatReply>) => {
    setStatus("thinking");
    pending
      .then((result) => {
        setReply(result);
        if (!conversation || !result.text.trim()) {
          setStatus(conversation ? "listening" : "answered");
          if (conversation) resumeRef.current();
          return;
        }
        setStatus("speaking");
        stopSpeaking.current = speak(result.text, lang, () => {
          stopSpeaking.current = null;
          if (statusRef.current === "speaking") resumeRef.current();
        }, { gender: "male", natural: true, onWord: () => setSpokenWords((count) => count + 1) });
      })
      .catch(() => setStatus("paused"));
  }, [conversation, lang, setStatus]);

  const finishAndAsk = React.useCallback(
    (text: string) => {
      stopListening();
      respond(askRef.current(text));
    },
    [respond, stopListening]
  );

  /** Arranca el reconocedor sin tocar el estado: lo usan el efecto de apertura y `listen`. */
  const startRecognizer = React.useCallback(() => {
    recognizer.current?.stop();
    turn.current += 1;
    const mine = turn.current;
    // Solo cuenta lo que oye este reconocedor mientras se está escuchando (no mientras piensa o habla).
    const isCurrent = () => mine === turn.current && statusRef.current === "listening";
    recognizer.current = createRecognizer({
      lang,
      onTranscript: (finalText, interimText) => {
        if (!isCurrent()) return;
        setTranscript(finalText);
        setInterim(interimText);
        clearSilence();
        // La pausa cuenta desde lo último que se oyó, firme o no: Chrome a veces tarda en dar la
        // frase por terminada y, si se esperara a eso, habría que mandarla a mano.
        const heard = [finalText, interimText].filter(Boolean).join(" ").trim();
        retries.current = 0;
        // Una pausa para pensar a mitad de frase no es «ya terminé»: sin cerrar, o en «…con», se espera más.
        const factor = UNFINISHED_ENDING.test(heard) ? UNFINISHED_PHRASE_FACTOR : interimText ? OPEN_PHRASE_FACTOR : 1;
        if (heard) silence.current = window.setTimeout(() => isCurrent() && finishAndAsk(heard), silenceMs * factor);
      },
      onError: (kind) => {
        if (kind === "denied") return setStatus("denied");
        // Un corte pasajero (red, audio): se sigue escuchando y `onEnd` lo retoma; tras varios seguidos, en pausa.
        retries.current += 1;
        if (retries.current > MAX_RETRIES) setStatus("paused");
      },
      onEnd: () => {
        // El navegador corta solo cada cierto tiempo: si seguíamos escuchando, se retoma.
        if (isCurrent()) recognizer.current?.start();
      },
    });
    recognizer.current?.start();
  }, [lang, silenceMs, finishAndAsk, setStatus]);

  const listen = React.useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      setStatus("unsupported");
      return;
    }
    setStatus("listening");
    startRecognizer();
  }, [startRecognizer, setStatus]);

  // En conversación, después de hablar: lo dicho antes se limpia y se escucha de nuevo (la respuesta queda a la vista).
  React.useEffect(() => {
    resumeRef.current = () => {
      setTranscript("");
      setInterim("");
      listen();
    };
  }, [listen]);

  /** Lo que se toca en vez de decirlo (una opción en pantalla): se responde igual que si se hubiera dicho. */
  const submit = React.useCallback(
    (text: string) => {
      stopSpeaking.current?.();
      stopSpeaking.current = null;
      setTranscript(text);
      setInterim("");
      finishAndAsk(text);
    },
    [finishAndAsk]
  );

  const pause = React.useCallback(() => {
    stopListening();
    setStatus("paused");
  }, [setStatus, stopListening]);

  const reset = React.useCallback(() => {
    setTranscript("");
    setInterim("");
    setReply(null);
    setSeconds(0);
  }, []);

  // Abrir empieza a escuchar; cerrar suelta el micrófono. La sesión se monta
  // limpia cada vez (ChatVoiceMode la desmonta al cerrar), así que no hay
  // nada que reiniciar aquí.
  React.useEffect(() => {
    if (!open) return;
    // Con saludo, primero habla el asistente y después se escucha (lo retoma `respond`).
    if (openingRef.current) {
      if (!greeted.current) {
        greeted.current = true;
        respond(openingRef.current());
      }
    } else if (isSpeechRecognitionSupported()) startRecognizer();
    return () => {
      stopListening();
      recognizer.current = null;
      stopSpeaking.current?.();
    };
  }, [open, startRecognizer, respond, stopListening]);

  // El cronómetro corre mientras se escucha.
  React.useEffect(() => {
    if (status !== "listening") return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  const toggleMic = React.useCallback(() => {
    // Mientras habla, tocar el micrófono lo interrumpe y escucha.
    if (status === "speaking") {
      stopSpeaking.current?.();
      stopSpeaking.current = null;
      resumeRef.current();
      return;
    }
    if (status === "listening") {
      pause();
      return;
    }
    if (status === "answered") reset();
    listen();
  }, [status, pause, listen, reset]);

  return { status, transcript, interim, reply, seconds, spokenWords, toggleMic, pause, listen, reset, submit };
}
