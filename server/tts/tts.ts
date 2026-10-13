/**
 * La voz de Clipper en el servidor: convierte un texto en audio (mp3) con un servicio de voz neural,
 * en español o en inglés según el idioma de la app. Las claves viven solo aquí (variables de entorno
 * de la función); el navegador nunca las ve. Sin proveedor configurado responde 501 y la app usa la
 * voz del navegador.
 *
 * Proveedores (el primero con clave en este orden, o el de `TTS_PROVIDER`):
 * - `gemini` (el elegido): la voz de Gemini (Google AI Studio), natural y conversacional, con capa
 *   gratuita y sin tarjeta; devuelve PCM y aquí se envuelve en WAV.
 * - `azure`: voces neurales de Microsoft, con capa gratuita mensual; una voz por idioma.
 * - `elevenlabs`: la más natural; una sola voz multilingüe (`TTS_VOICE`) para los dos idiomas.
 * - `openai`: `gpt-4o-mini-tts`, muy conversacional; voces multilingües.
 */

export type TtsProvider = "gemini" | "elevenlabs" | "azure" | "openai";
export type TtsLang = "es" | "en";

export interface TtsConfig {
  provider: TtsProvider | null;
  geminiKey?: string;
  elevenLabsKey?: string;
  azureKey?: string;
  azureRegion?: string;
  openAiKey?: string;
  /** Una voz para todo (ElevenLabs, OpenAI) o la de cada idioma (`TTS_VOICE_ES`, `TTS_VOICE_EN`). */
  voice?: string;
  voiceEs?: string;
  voiceEn?: string;
}

export const MAX_TEXT_LENGTH = 1200;

/** Voces masculinas por defecto: cálidas y naturales, de cada proveedor. */
const DEFAULT_VOICES: Record<TtsProvider, Record<TtsLang, string>> = {
  // «Achird», voz masculina amable de Gemini; la misma habla español e inglés.
  gemini: { es: "Achird", en: "Achird" },
  // «Eric», voz predeterminada de ElevenLabs: la elegida para Clipper. Las predeterminadas funcionan
  // con el plan gratuito; las de la biblioteca (`TTS_VOICE`) piden un plan de pago. El modelo es
  // multilingüe: la misma voz habla español e inglés.
  elevenlabs: { es: "cjVigY5qzO86Huf0OWal", en: "cjVigY5qzO86Huf0OWal" },
  // Gonzalo (Colombia) y Andrew (multilingüe, muy conversacional).
  azure: { es: "es-CO-GonzaloNeural", en: "en-US-AndrewMultilingualNeural" },
  openai: { es: "onyx", en: "onyx" },
};

const LOCALE: Record<TtsLang, string> = { es: "es-CO", en: "en-US" };
/** Gemini se dirige con lenguaje natural: el tono va delante del texto. */
const GEMINI_STYLE: Record<TtsLang, string> = {
  es: "Dilo en español latino, con voz cálida, cercana y natural, como un barbero amable que atiende por teléfono",
  en: "Say it in a warm, friendly, natural voice, like a kind barber answering the phone",
};
const GEMINI_MODEL = "gemini-2.5-flash-preview-tts";

const OPENAI_STYLE: Record<TtsLang, string> = {
  es: "Habla en español latino, con voz de hombre cálida, cercana y natural, como un barbero amable que atiende por teléfono. Ritmo conversacional, sin sonar leído.",
  en: "Speak in a warm, friendly, natural male voice, like a kind barber answering the phone. Conversational pace, never sounding read.",
};

export function readTtsConfig(env: Record<string, string | undefined> = process.env): TtsConfig {
  const value = (key: string) => env[key]?.trim() || undefined;
  const available: TtsProvider[] = [];
  // Gemini primero: es el elegido (gratis con una clave de Google AI Studio, sin tarjeta).
  if (value("GEMINI_API_KEY")) available.push("gemini");
  if (value("AZURE_SPEECH_KEY") && value("AZURE_SPEECH_REGION")) available.push("azure");
  if (value("ELEVENLABS_API_KEY")) available.push("elevenlabs");
  if (value("OPENAI_API_KEY")) available.push("openai");
  const wanted = value("TTS_PROVIDER") as TtsProvider | undefined;
  return {
    provider: wanted && available.includes(wanted) ? wanted : (available[0] ?? null),
    geminiKey: value("GEMINI_API_KEY"),
    elevenLabsKey: value("ELEVENLABS_API_KEY"),
    azureKey: value("AZURE_SPEECH_KEY"),
    azureRegion: value("AZURE_SPEECH_REGION"),
    openAiKey: value("OPENAI_API_KEY"),
    voice: value("TTS_VOICE"),
    voiceEs: value("TTS_VOICE_ES"),
    voiceEn: value("TTS_VOICE_EN"),
  };
}

/** La voz con la que habla en ese idioma: la del entorno o la de por defecto del proveedor. */
export function voiceFor(config: TtsConfig, lang: TtsLang): string {
  if (!config.provider) return "";
  return (lang === "es" ? config.voiceEs : config.voiceEn) ?? config.voice ?? DEFAULT_VOICES[config.provider][lang];
}

const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function toSsml(text: string, voice: string, lang: TtsLang): string {
  return `<speak version="1.0" xml:lang="${LOCALE[lang]}"><voice name="${voice}">${escapeXml(text)}</voice></speak>`;
}

type Fetcher = typeof fetch;

function request(config: TtsConfig, text: string, lang: TtsLang): { url: string; init: RequestInit & { headers: Record<string, string> } } {
  const voice = voiceFor(config, lang);
  switch (config.provider) {
    case "gemini":
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        init: {
          method: "POST",
          headers: { "x-goog-api-key": config.geminiKey ?? "", "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${GEMINI_STYLE[lang]}: ${text}` }] }],
            generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
          }),
        },
      };
    case "elevenlabs":
      return {
        url: `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`,
        init: {
          method: "POST",
          headers: { "xi-api-key": config.elevenLabsKey ?? "", "content-type": "application/json", accept: "audio/mpeg" },
          body: JSON.stringify({ text, model_id: "eleven_flash_v2_5", language_code: lang, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true } }),
        },
      };
    case "azure":
      return {
        url: `https://${config.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
        init: {
          method: "POST",
          headers: { "Ocp-Apim-Subscription-Key": config.azureKey ?? "", "content-type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "user-agent": "barberlytics-clipper" },
          body: toSsml(text, voice, lang),
        },
      };
    default:
      return {
        url: "https://api.openai.com/v1/audio/speech",
        init: {
          method: "POST",
          headers: { authorization: `Bearer ${config.openAiKey ?? ""}`, "content-type": "application/json" },
          body: JSON.stringify({ model: "gpt-4o-mini-tts", voice, input: text, instructions: OPENAI_STYLE[lang], response_format: "mp3" }),
        },
      };
  }
}

const DEFAULT_PCM_RATE = 24000;

/**
 * Gemini devuelve el audio como PCM de 16 bits en base64 (`audio/L16;codec=pcm;rate=24000`); el navegador
 * no lo reproduce tal cual, así que se le pone la cabecera WAV. `null` si la respuesta no trae audio.
 */
export function geminiToWav(body: unknown): Uint8Array | null {
  const part = (body as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] })?.candidates?.[0]?.content?.parts?.find((item) => item.inlineData?.data)?.inlineData;
  if (!part?.data) return null;
  const pcm = Uint8Array.from(atob(part.data), (char) => char.charCodeAt(0));
  const rate = Number(/rate=(\d+)/.exec(part.mimeType ?? "")?.[1] ?? DEFAULT_PCM_RATE);
  const header = new DataView(new ArrayBuffer(44));
  const ascii = (offset: number, text: string) => [...text].forEach((char, index) => header.setUint8(offset + index, char.charCodeAt(0)));
  ascii(0, "RIFF");
  header.setUint32(4, 36 + pcm.length, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true); // PCM
  header.setUint16(22, 1, true); // mono
  header.setUint32(24, rate, true);
  header.setUint32(28, rate * 2, true); // bytes por segundo: 16 bits, mono
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  ascii(36, "data");
  header.setUint32(40, pcm.length, true);
  const wav = new Uint8Array(44 + pcm.length);
  wav.set(new Uint8Array(header.buffer), 0);
  wav.set(pcm, 44);
  return wav;
}

const json = (status: number, code: string, message: string) => new Response(JSON.stringify({ code, message }), { status, headers: { "content-type": "application/json" } });

/** Valida lo pedido y devuelve el audio del proveedor (o un error sin detalles del proveedor). */
export async function synthesize(payload: unknown, config: TtsConfig, fetcher: Fetcher = fetch): Promise<Response> {
  const { text, lang } = (payload ?? {}) as { text?: unknown; lang?: unknown };
  if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT_LENGTH) return json(400, "invalid_text", "Texto vacío o demasiado largo.");
  if (lang !== "es" && lang !== "en") return json(400, "invalid_lang", "Idioma no soportado.");
  if (!config.provider) return json(501, "tts_not_configured", "No hay un servicio de voz configurado.");
  const { url, init } = request(config, text.trim(), lang);
  try {
    const upstream = await fetcher(url, init);
    if (!upstream.ok) return json(502, "tts_failed", "El servicio de voz no respondió.");
    if (config.provider === "gemini") {
      const wav = geminiToWav(await upstream.json());
      if (!wav) return json(502, "tts_failed", "El servicio de voz no respondió.");
      return new Response(wav, { status: 200, headers: { "content-type": "audio/wav", "cache-control": "no-store" } });
    }
    return new Response(upstream.body, { status: 200, headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
  } catch {
    return json(502, "tts_failed", "El servicio de voz no respondió.");
  }
}
