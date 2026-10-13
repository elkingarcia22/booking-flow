import * as React from "react";
import type { ChatReply } from "@/lib/chat";
import { useAppT } from "@/app/i18n";
import { useLocale } from "@/i18n";
import type { ChatEngine } from "./useChatBooking";
import { fromVoice, matchSpokenOption, saysOnlyOption, voiceReplyFromTurns } from "./voiceReply";

/** Cuánto tiene que quedarse quieta la conversación (sin «escribiendo» ni mensajes nuevos) para dar la respuesta por dicha. */
const SETTLE_MS = 700;
/** Si el motor no contesta, la voz no se queda esperando para siempre. */
const MAX_WAIT_MS = 12000;

/** Lo que se puede pedir desde el saludo de Clipper. */
type MenuChoice = "book" | "manage" | "gift" | "packages";

/** De qué experiencia llega la voz: Paso a paso pide quién eres; el resto, qué quieres hacer. */
export type VoiceOrigin = "guided" | "menu";

interface Waiter {
  from: number;
  resolve: (reply: ChatReply) => void;
  settle?: number;
  deadline: number;
}

/**
 * La conversación por voz con Clipper sobre el mismo motor del chat escrito: lo dicho entra como si
 * se hubiera escrito (`begin` desde la portada, `send` en el chat), así entiende los mismos casos
 * —servicio, barbero, día y hora en una frase, el celular, el código, elegir de una lista, cambiar
 * algo, pagar, el recibo—, y cuando Clipper termina de contestar devuelve lo que hay que decirle.
 */
export function useVoiceBridge(
  engine: ChatEngine,
  {
    started,
    start,
    shopName,
    hasPackages,
    openSide,
  }: {
    started: boolean;
    /** Abre la conversación; sin texto, con el saludo de siempre (que pide el celular). */
    start: (text?: string) => void;
    shopName: string;
    hasPackages: boolean;
    /** Regalar o comprar un paquete: sus pantallas, fuera de la voz. */
    openSide: (step: "gift" | "packages") => void;
  }
) {
  const t = useAppT();
  const { locale } = useLocale();
  const latest = React.useRef({ engine, started, start, shopName, hasPackages, openSide });
  const waiter = React.useRef<Waiter | null>(null);
  /** Las opciones que Clipper acaba de leer: lo dicho se busca entre ellas («la segunda», «no gracias»). */
  const lastOptions = React.useRef<readonly string[]>([]);
  /** El menú del saludo, mientras no se haya respondido: su texto → qué hace. */
  const menu = React.useRef<Readonly<Record<string, MenuChoice>> | null>(null);
  /** Si la llamada ya empezó con el saludo de Clipper, el «¡Hola!» de la conversación no se repite. */
  const greeted = React.useRef(false);

  React.useLayoutEffect(() => {
    latest.current = { engine, started, start, shopName, hasPackages, openSide };
  });

  const finish = React.useCallback(
    (current: Waiter) => {
      if (waiter.current !== current) return;
      waiter.current = null;
      window.clearTimeout(current.settle);
      window.clearTimeout(current.deadline);
      const shop = latest.current.shopName;
      const hellos = greeted.current ? [t("booking.chat.hello", { shop }), t("booking.chat.helloWithIntent", { shop }), t("booking.chat.helloLast", { shop })] : [];
      const fresh = latest.current.engine.turns.slice(current.from).filter((turn) => !hellos.includes(turn.text ?? ""));
      const reply = voiceReplyFromTurns(fresh, locale, { oneOf: (list) => t("booking.chat.voiceOneOf", { list }), someOf: (list) => t("booking.chat.voiceSomeOf", { list }), when: t("booking.chat.voiceWhen"), propose: (list) => t("booking.chat.voicePropose", { list }) });
      // Solo valen las opciones que acaba de leer: si pidió un dato (el celular, el correo), no hay lista.
      lastOptions.current = reply.followups ?? [];
      current.resolve(reply);
    },
    [locale, t]
  );

  // Cada mensaje nuevo (o el fin de «escribiendo») reinicia la espera; quieta un momento, se responde.
  React.useEffect(() => {
    const current = waiter.current;
    if (!current) return;
    window.clearTimeout(current.settle);
    if (engine.typing) return;
    if (!engine.turns.slice(current.from).some((turn) => turn.from === "agent")) return;
    current.settle = window.setTimeout(() => finish(current), SETTLE_MS);
  }, [engine.turns, engine.typing, finish]);

  React.useEffect(() => () => {
    if (waiter.current) {
      window.clearTimeout(waiter.current.settle);
      window.clearTimeout(waiter.current.deadline);
    }
  }, []);

  /** Manda algo a la conversación (o la abre) y espera a que Clipper termine de contestar. */
  const converse = React.useCallback(
    (run: (current: ChatEngine) => void) =>
      new Promise<ChatReply>((resolve) => {
        const current = latest.current.engine;
        const next: Waiter = { from: current.turns.length, resolve, deadline: 0 };
        next.deadline = window.setTimeout(() => finish(next), MAX_WAIT_MS);
        waiter.current = next;
        run(current);
      }),
    [finish]
  );

  /**
   * La opción que eligió, solo si eso es todo lo que dijo («corte clásico», «la segunda», «con Emilio»).
   * «Corte clásico con Andrés mañana a las 3» no es elegir «Corte clásico»: va entera, con todo.
   */
  const pickOption = React.useCallback(
    (text: string, options: readonly string[]): string | null => {
      const option = matchSpokenOption(text, options, locale);
      if (!option) return null;
      const byPlace = /^\d+$/.test(fromVoice(text, locale).trim());
      return byPlace || saysOnlyOption(text, option, locale) ? option : null;
    },
    [locale]
  );

  const ask = React.useCallback(
    (text: string): Promise<ChatReply> => {
      const { started: isStarted, start: begin } = latest.current;
      // Respuesta al saludo: agendar, ver sus citas, regalar o un paquete; lo demás es una petición.
      const choices = menu.current;
      menu.current = null;
      const label = choices ? pickOption(text, Object.keys(choices)) : null;
      const choice = label && choices ? choices[label] : null;
      if (choice === "gift" || choice === "packages") {
        latest.current.openSide(choice);
        return Promise.resolve({ text: "" });
      }
      if (choice === "book") return converse(() => begin());
      if (choice === "manage") return converse(() => begin(t("booking.chat.ideaManagePrompt")));
      const said = pickOption(text, lastOptions.current) ?? fromVoice(text, locale);
      return converse((current) => (isStarted ? current.send(said) : begin(said)));
    },
    [converse, locale, t, pickOption]
  );

  /**
   * El saludo con el que Clipper abre la llamada. Desde Paso a paso, el de la conversación (pide el
   * celular para saber quién eres); desde la Agenda con selector o la portada, qué quieres hacer hoy.
   */
  const greet = React.useCallback(
    (origin: VoiceOrigin): Promise<ChatReply> => {
      if (origin === "guided") return converse(() => latest.current.start());
      const { shopName: shop, hasPackages: packages } = latest.current;
      const choices: Record<string, MenuChoice> = {
        [t("booking.chat.voiceMenuBook")]: "book",
        [t("booking.chat.voiceMenuManage")]: "manage",
        [t("booking.chat.voiceMenuGift")]: "gift",
        ...(packages ? { [t("booking.chat.voiceMenuPackages")]: "packages" as const } : {}),
      };
      menu.current = choices;
      greeted.current = true;
      lastOptions.current = [];
      return Promise.resolve({ text: t(packages ? "booking.chat.voiceMenu" : "booking.chat.voiceMenuNoPackages", { shop }), followups: Object.keys(choices) });
    },
    [converse, t]
  );

  return { ask, greet };
}
