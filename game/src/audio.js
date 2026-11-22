// Synthesized sound effects: everything is built with the Web Audio API at runtime, so the
// game ships no audio files and makes no network request. The context is created lazily on the
// first user gesture (browsers block audio before that) and every call is a no-op until then.

let context = null;
let alarmOsc = null;
let alarmGain = null;

function ensure() {
  if (context) return context;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
  } catch {
    context = null;
  }
  return context;
}

/** Call from a user gesture so the browser unlocks audio. */
export function unlockAudio() {
  const ctx = ensure();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function tone(freq, duration, type, volume, when = 0, slideTo = null) {
  const ctx = ensure();
  if (!ctx) return;
  const start = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function noise(duration, volume, filterFreq, when = 0) {
  const ctx = ensure();
  if (!ctx) return;
  const start = ctx.currentTime + when;
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(start);
}

export const sfx = {
  /** A soft coin blip when loot is picked up. */
  pickup() {
    tone(880, 0.12, 'sine', 0.18);
    tone(1318, 0.18, 'sine', 0.15, 0.07);
  },
  /** The Sapphire: a bright three-note chime. */
  sapphire() {
    tone(1046, 0.16, 'triangle', 0.2);
    tone(1318, 0.16, 'triangle', 0.2, 0.1);
    tone(1760, 0.34, 'triangle', 0.22, 0.2);
  },
  /** The smoke veil: a low whoosh. */
  veil() {
    noise(0.55, 0.3, 900);
    tone(220, 0.4, 'sine', 0.1, 0, 110);
  },
  /** A decoy coin: a metallic tick-tick. */
  decoy() {
    tone(2400, 0.05, 'square', 0.08);
    tone(2400, 0.05, 'square', 0.08, 0.12);
  },
  /** Caught: a short falling sting. */
  caught() {
    tone(392, 0.22, 'sawtooth', 0.16, 0, 196);
    tone(196, 0.4, 'sawtooth', 0.16, 0.18, 98);
  },
  /** Escaped: a rising getaway arpeggio. */
  escaped() {
    tone(523, 0.14, 'triangle', 0.2);
    tone(659, 0.14, 'triangle', 0.2, 0.12);
    tone(784, 0.14, 'triangle', 0.2, 0.24);
    tone(1046, 0.4, 'triangle', 0.22, 0.36);
  },
  /** A guard spots Sable: one sharp alert blip (throttled by the caller). */
  spotted() {
    tone(1175, 0.09, 'square', 0.07);
  },
  /**
   * The alarm drone: a quiet pulsing tone while the meter is high. Call every frame with the
   * current alarm value; it starts, stops and retunes itself.
   */
  alarmDrone(alarmValue) {
    const ctx = ensure();
    if (!ctx) return;
    if (alarmValue < 50) {
      if (alarmOsc) {
        try {
          alarmOsc.stop();
        } catch {
          // Already stopped.
        }
        alarmOsc = null;
        alarmGain = null;
      }
      return;
    }
    if (!alarmOsc) {
      alarmOsc = ctx.createOscillator();
      alarmGain = ctx.createGain();
      alarmOsc.type = 'sine';
      alarmOsc.frequency.value = 220;
      alarmGain.gain.value = 0.0;
      alarmOsc.connect(alarmGain).connect(ctx.destination);
      alarmOsc.start();
    }
    const pulse = 0.5 + 0.5 * Math.sin(ctx.currentTime * 6);
    alarmGain.gain.setTargetAtTime(0.03 + 0.03 * pulse, ctx.currentTime, 0.05);
    alarmOsc.frequency.setTargetAtTime(200 + alarmValue * 1.6, ctx.currentTime, 0.1);
  },
};
