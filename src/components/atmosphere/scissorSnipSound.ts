/**
 * El «chas» de unas tijeras de barbero, hecho en el navegador con Web Audio (sin archivos):
 * primero el roce de las hojas al cerrarse —un siseo que sube de tono— y al final el golpe
 * metálico cuando se juntan. Cada corte suena un poco distinto, como en la vida real.
 */

/** Cuánto dura el roce antes del golpe; el golpe cae justo cuando las hojas se cierran. */
export const SNIP_LEAD_MS = 55;
const NOISE_SECONDS = 0.3;
const SILENT = 0.0001;

export interface SnipPlayer {
  /** Programa un corte por cada momento (ms desde ahora) en que las hojas se cierran. */
  schedule: (closesAtMs: readonly number[]) => void;
  /** Corta lo que falte y libera el audio. */
  stop: () => void;
}

type AudioContextClass = typeof AudioContext;

function audioContextClass(): AudioContextClass | null {
  if (typeof window === "undefined") return null;
  const legacy = (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext;
  return window.AudioContext ?? legacy ?? null;
}

function noiseBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, Math.round(context.sampleRate * NOISE_SECONDS), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Un golpe de ruido filtrado con su envolvente: la base del roce y del golpe. */
function noiseHit(context: AudioContext, out: AudioNode, noise: AudioBuffer, at: number, filter: BiquadFilterNode, peak: number, attack: number, decay: number) {
  const source = context.createBufferSource();
  source.buffer = noise;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(SILENT, at + attack + decay);
  source.connect(filter).connect(gain).connect(out);
  source.start(at, Math.random() * (NOISE_SECONDS - attack - decay - 0.01));
  source.stop(at + attack + decay + 0.02);
}

function playSnip(context: AudioContext, out: AudioNode, noise: AudioBuffer, at: number) {
  const pitch = 0.92 + Math.random() * 0.16;
  const lead = SNIP_LEAD_MS / 1000;

  // El roce: las hojas deslizándose una contra otra.
  const scrape = context.createBiquadFilter();
  scrape.type = "bandpass";
  scrape.Q.value = 1.4;
  scrape.frequency.setValueAtTime(3200 * pitch, at);
  scrape.frequency.exponentialRampToValueAtTime(7600 * pitch, at + lead);
  noiseHit(context, out, noise, at, scrape, 0.32, 0.008, lead + 0.015);

  // El golpe: las hojas se juntan en la punta.
  const click = context.createBiquadFilter();
  click.type = "highpass";
  click.frequency.value = 2600 * pitch;
  noiseHit(context, out, noise, at + lead, click, 0.75, 0.001, 0.028);

  // Un tintineo corto del acero, casi debajo del golpe.
  const ring = context.createOscillator();
  ring.type = "triangle";
  ring.frequency.value = 2900 * pitch;
  const ringGain = context.createGain();
  ringGain.gain.setValueAtTime(0.12, at + lead);
  ringGain.gain.exponentialRampToValueAtTime(SILENT, at + lead + 0.05);
  ring.connect(ringGain).connect(out);
  ring.start(at + lead);
  ring.stop(at + lead + 0.06);
}

/**
 * Prepara el sonido de los cortes. Devuelve `null` si el navegador no tiene Web Audio (o no deja
 * crearlo): la animación sigue sin sonido. Si el navegador todavía no permite audio (nadie tocó la
 * página), los cortes simplemente no suenan.
 */
export function createSnipPlayer(volume = 0.6): SnipPlayer | null {
  const AudioCtor = audioContextClass();
  if (!AudioCtor) return null;
  let context: AudioContext;
  try {
    context = new AudioCtor();
  } catch {
    return null;
  }
  const master = context.createGain();
  master.gain.value = volume;
  master.connect(context.destination);
  const noise = noiseBuffer(context);

  return {
    schedule: (closesAtMs) => {
      const start = () => {
        const now = context.currentTime;
        for (const closesAt of closesAtMs) playSnip(context, master, noise, now + Math.max(0, closesAt - SNIP_LEAD_MS) / 1000);
      };
      if (context.state === "running") start();
      else context.resume().then(start, () => undefined);
    },
    stop: () => {
      master.disconnect();
      context.close().catch(() => undefined);
    },
  };
}
