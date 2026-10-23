/**
 * El micrófono y la voz del navegador, sin depender de que existan.
 *
 * Web Speech está en Chrome, Edge y Safari, y en cada uno con su prefijo.
 * Aquí se envuelve en dos funciones pequeñas para que el modo voz pregunte
 * «¿puedo escuchar?» y, si no, muestre lo mismo con una transcripción escrita.
 */

import { serverFetch } from "@/lib/api/serverSession";

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return recognitionCtor() !== null;
}

export interface Recognizer {
  start: () => void;
  stop: () => void;
}

export interface RecognizerOptions {
  lang: string;
  /** Lo dicho hasta ahora: lo firme y lo que aún se está entendiendo. */
  onTranscript: (finalText: string, interimText: string) => void;
  /** `denied` si no hay permiso; el resto son fallos del servicio. */
  onError?: (kind: "denied" | "unavailable" | "other") => void;
  onEnd?: () => void;
}

/** Un reconocedor continuo con resultados parciales; `null` si el navegador no puede. */
export function createRecognizer(options: RecognizerOptions): Recognizer | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = options.lang;
  recognition.continuous = true;
  recognition.interimResults = true;
  let finalText = "";
  recognition.onresult = (event) => {
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (result.isFinal) finalText += `${result[0].transcript} `;
      else interim += result[0].transcript;
    }
    options.onTranscript(finalText.trim(), interim.trim());
  };
  recognition.onerror = (event) => {
    const kind = event.error === "not-allowed" || event.error === "service-not-allowed" ? "denied" : event.error === "network" || event.error === "audio-capture" ? "unavailable" : "other";
    if (event.error !== "no-speech" && event.error !== "aborted") options.onError?.(kind);
  };
  recognition.onend = () => options.onEnd?.();
  return {
    start: () => {
      try {
        recognition.start();
      } catch {
        // Ya estaba escuchando: se ignora.
      }
    },
    stop: () => recognition.stop(),
  };
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Lo que se necesita de una voz del navegador (`SpeechSynthesisVoice`) para elegirla. */
export interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
}

export type VoiceGender = "male" | "female";

/** Nombres de voces de sistema (macOS, Windows, Edge, Chrome) para reconocer si suenan a hombre o a mujer. */
const MALE_NAMES = /\b(jorge|juan|diego|carlos|gonzalo|[aá]lvaro|ra[uú]l|pablo|dar[ií]o|gerardo|alonso|tom[aá]s|andr[eé]s|eddy|reed|rocko|grandpa|emilio|federico|lorenzo|mateo|sergio|jos[eé]|alex|arnau|manuel|enrique|guy|davis|andrew|brian|christopher|eric|daniel|fred|aaron|tom|liam|ryan)\b/i;
const FEMALE_NAMES = /\b(paulina|m[oó]nica|marisol|elvira|dalia|salom[eé]|helena|laura|sabina|luc[ií]a|elena|ximena|camila|valentina|paloma|catalina|google espa[nñ]ol|samantha|victoria|karen|moira|tessa|zira|aria|jenny|michelle|sara|shelley|flo|sandy)\b/i;
/** Las voces neuronales suenan mucho más naturales: «Online (Natural)» en Edge, «Premium/Enhanced» en macOS. */
const NATURAL = /natural|neural|online|premium|enhanced|mejorad/i;

/**
 * Elige la voz con la que habla Clipper: del mismo idioma (mejor de la misma región), natural si la
 * hay y, entre ellas, del género pedido. `null` si el navegador no tiene ninguna del idioma.
 */
export function pickVoice(voices: readonly VoiceLike[], lang: string, gender: VoiceGender = "male"): VoiceLike | null {
  const language = lang.slice(0, 2).toLowerCase();
  const wanted = gender === "male" ? MALE_NAMES : FEMALE_NAMES;
  const other = gender === "male" ? FEMALE_NAMES : MALE_NAMES;
  const score = (voice: VoiceLike) =>
    (voice.lang.toLowerCase().replace("_", "-") === lang.toLowerCase() ? 3 : 0) +
    (NATURAL.test(voice.name) ? 4 : 0) +
    (wanted.test(voice.name) ? 6 : 0) -
    (other.test(voice.name) ? 6 : 0);
  const candidates = voices.filter((voice) => voice.lang.toLowerCase().startsWith(language));
  if (candidates.length === 0) return null;
  return candidates.reduce((best, voice) => (score(voice) > score(best) ? voice : best));
}

/** El texto tal como se dice: sin markdown, enlaces, emoji ni flechas; los separadores se vuelven pausas. */
export function toSpeech(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>~]/g, "")
    .replace(/(?:[•*]\s*){2,}/g, "")
    .replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/([^.:!?\s])\s*\n+\s*/g, "$1. ")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s*(→|·|•|—)\s*/g, ", ")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Las voces del navegador; en Chrome llegan tarde, así que se espera a que estén (o a que pase un momento). */
export function loadVoices(): Promise<readonly SpeechSynthesisVoice[]> {
  if (!isSpeechSynthesisSupported()) return Promise.resolve([]);
  const now = window.speechSynthesis.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    window.setTimeout(done, VOICES_WAIT_MS);
  });
}

const VOICES_WAIT_MS = 1200;
/** El tope para dar por dicho un texto: un margen más lo que tarda cada palabra a ritmo lento. */
const SPEAK_GUARD_BASE_MS = 3000;
const SPEAK_GUARD_PER_WORD_MS = 600;

export interface SpeakOptions {
  /** Con qué voz: Clipper habla con voz de hombre. */
  gender?: VoiceGender;
  /** Cada palabra que dice (para que las ondas se muevan con su voz). */
  onWord?: () => void;
  /**
   * Con la voz natural del servicio de voz (`api/tts`) si está configurado; si no, la del navegador.
   * La conversación por voz con Clipper la usa; leer un mensaje en el chat, no.
   */
  natural?: boolean;
}

/** El servicio de voz natural (función `api/tts`): voz neural de hombre, en español o inglés. */
const TTS_ENDPOINT = "/api/tts";
/** Cada cuánto «late» la voz natural mientras suena (no avisa palabra por palabra como la del navegador). */
const AUDIO_PULSE_MS = 260;
/** Si el servidor dijo que no hay servicio de voz, no se vuelve a preguntar en esta sesión. */
let naturalVoiceUnavailable = false;

/** El audio de la voz natural, o `null` si no hay servicio (sin configurar, sin red, en local sin funciones). */
async function naturalVoice(text: string, lang: string, signal: AbortSignal): Promise<Blob | null> {
  if (naturalVoiceUnavailable || typeof fetch === "undefined") return null;
  try {
    const response = await serverFetch(
      TTS_ENDPOINT,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, lang: lang.toLowerCase().startsWith("en") ? "en" : "es" }),
        signal,
      },
      // La reserva en línea no tiene sesión del equipo: pide una de invitado, que solo vale para la voz.
      { guest: true }
    );
    const type = response.headers.get("content-type") ?? "";
    if (response.ok && type.startsWith("audio/")) return await response.blob();
    // Sin servicio (501) o sin funciones (404, o responde la app): la voz del navegador desde ya. Sin
    // sesión (401) o sin cupo (429) solo esta vez: puede llegar la sesión o liberarse el cupo.
    if (response.status === 501 || response.status === 404 || (response.ok && !type.startsWith("audio/"))) naturalVoiceUnavailable = true;
    return null;
  } catch {
    return null;
  }
}

/** Lee un texto en voz alta; devuelve cómo pararlo. Sin voz en el navegador no hace nada. */
export function speak(text: string, lang: string, onEnd?: () => void, options: SpeakOptions = {}): () => void {
  const hasBrowserVoice = isSpeechSynthesisSupported();
  if (!hasBrowserVoice && !options.natural) {
    onEnd?.();
    return () => {};
  }
  let cancelled = false;
  let ended = false;
  let guard = 0;
  // Algunas voces nunca avisan que terminaron: pasado el tiempo que tomaría decirlo, se da por dicho.
  const end = () => {
    if (ended) return;
    ended = true;
    window.clearTimeout(guard);
    onEnd?.();
  };
  const spoken = toSpeech(text);
  if (hasBrowserVoice) window.speechSynthesis.cancel();
  const controller = new AbortController();
  let audio: HTMLAudioElement | null = null;
  let pulse = 0;
  let audioUrl = "";
  const stopAudio = () => {
    window.clearInterval(pulse);
    audio?.pause();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  };
  /** La voz del navegador: la de siempre, o el respaldo si la natural no está. */
  const browserVoice = () => {
    if (!hasBrowserVoice) return end();
    void loadVoices().then((voices) => {
      if (cancelled) return;
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = lang;
    const voice = options.gender ? (pickVoice(voices, lang, options.gender) as SpeechSynthesisVoice | null) : null;
    if (voice) utterance.voice = voice;
    utterance.onend = end;
    utterance.onerror = end;
    guard = window.setTimeout(end, SPEAK_GUARD_BASE_MS + spoken.split(/\s+/).length * SPEAK_GUARD_PER_WORD_MS);
    if (options.onWord) utterance.onboundary = (event) => event.name === "word" && options.onWord?.();
    window.speechSynthesis.speak(utterance);
    });
  };
  if (!options.natural) browserVoice();
  else
    void naturalVoice(spoken, lang, controller.signal).then((blob) => {
      if (cancelled) return;
      if (!blob) return browserVoice();
      audioUrl = URL.createObjectURL(blob);
      audio = new Audio(audioUrl);
      const finish = () => {
        stopAudio();
        end();
      };
      audio.onended = finish;
      audio.onerror = finish;
      if (options.onWord) pulse = window.setInterval(() => options.onWord?.(), AUDIO_PULSE_MS);
      // Si el navegador no deja reproducir (sin un toque antes), se dice con su propia voz.
      audio.play().catch(() => {
        stopAudio();
        browserVoice();
      });
    });
  return () => {
    cancelled = true;
    ended = true;
    window.clearTimeout(guard);
    controller.abort();
    stopAudio();
    if (hasBrowserVoice) window.speechSynthesis.cancel();
  };
}
