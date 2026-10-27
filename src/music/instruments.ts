// Sound design only: turns NoteEvents into Tone.js voices. Kept apart from mapping.ts so the
// composition stays pure and testable. Not unit-tested (needs an AudioContext); see player.ts.
import type * as ToneModule from 'tone';
import type { GenreId, NoteEvent } from './types';

export type ToneLib = typeof ToneModule;

type Osc = 'sine' | 'triangle' | 'square' | 'sawtooth';

interface Voicing {
  lead: Osc;
  leadEnv: [attack: number, decay: number, sustain: number, release: number];
  leadCutoff: number;
  pad: Osc;
  padAttack: number;
  bass: Osc;
  bassCutoff: number;
  reverbDecay: number;
  reverbWet: number;
  /** Per-voice gain in dB: lead, pad, bass, drums. */
  db: [number, number, number, number];
}

const VOICINGS: Record<GenreId, Voicing> = {
  lofi: { lead: 'triangle', leadEnv: [0.01, 0.25, 0.15, 0.6], leadCutoff: 2200, pad: 'sine', padAttack: 0.5, bass: 'sine', bassCutoff: 600, reverbDecay: 2.5, reverbWet: 0.3, db: [-8, -14, -6, -10] },
  synthwave: { lead: 'sawtooth', leadEnv: [0.01, 0.2, 0.3, 0.4], leadCutoff: 3500, pad: 'sawtooth', padAttack: 0.4, bass: 'sawtooth', bassCutoff: 700, reverbDecay: 3, reverbWet: 0.35, db: [-14, -22, -10, -8] },
  chiptune: { lead: 'square', leadEnv: [0.002, 0.1, 0.4, 0.08], leadCutoff: 8000, pad: 'triangle', padAttack: 0.05, bass: 'triangle', bassCutoff: 1200, reverbDecay: 0.8, reverbWet: 0.08, db: [-16, -16, -8, -10] },
  house: { lead: 'sawtooth', leadEnv: [0.005, 0.12, 0.05, 0.15], leadCutoff: 3000, pad: 'sawtooth', padAttack: 0.2, bass: 'square', bassCutoff: 500, reverbDecay: 1.5, reverbWet: 0.2, db: [-13, -22, -8, -6] },
  ambient: { lead: 'sine', leadEnv: [0.05, 0.4, 0.4, 1.5], leadCutoff: 4000, pad: 'sine', padAttack: 1.2, bass: 'sine', bassCutoff: 400, reverbDecay: 6, reverbWet: 0.55, db: [-10, -10, -9, -14] },
};

export interface Rig {
  /** Trigger one event at audio time `time`; `secPerBeat` converts beat durations to seconds. */
  trigger(e: NoteEvent, time: number, secPerBeat: number): void;
  dispose(): void;
}

// PolySynth voices stay allocated through their release tails, so size them well above the
// composer's MAX_POLYPHONY (which counts only sounding notes).
const LEAD_VOICES = 32;
const PAD_VOICES = 16;

export async function buildRig(Tone: ToneLib, genre: GenreId): Promise<Rig> {
  const v = VOICINGS[genre];
  const nodes: { dispose(): unknown }[] = [];
  const keep = <T extends { dispose(): unknown }>(n: T): T => (nodes.push(n), n);

  const limiter = keep(new Tone.Limiter(-1).toDestination());
  const headroom = keep(new Tone.Volume(-3).connect(limiter));
  const comp = keep(new Tone.Compressor(-18, 3).connect(headroom));
  const reverb = keep(new Tone.Reverb({ decay: v.reverbDecay, wet: v.reverbWet }).connect(comp));
  await reverb.ready;

  const env = (a: number, d: number, s: number, r: number) => ({ attack: a, decay: d, sustain: s, release: r });

  const leadFilter = keep(new Tone.Filter(v.leadCutoff, 'lowpass'));
  leadFilter.connect(comp);
  leadFilter.connect(reverb);
  const lead = keep(
    new Tone.PolySynth({
      voice: Tone.Synth,
      maxPolyphony: LEAD_VOICES,
      options: { oscillator: { type: v.lead }, envelope: env(...v.leadEnv), volume: v.db[0] },
    }).connect(leadFilter),
  );

  const pad = keep(
    new Tone.PolySynth({
      voice: Tone.Synth,
      maxPolyphony: PAD_VOICES,
      options: { oscillator: { type: v.pad }, envelope: env(v.padAttack, 0.5, 0.8, 1.5), volume: v.db[1] },
    }),
  );
  const padFilter = keep(new Tone.Filter(1800, 'lowpass'));
  pad.connect(padFilter);
  padFilter.connect(reverb);
  padFilter.connect(comp);

  const bassFilter = keep(new Tone.Filter(v.bassCutoff, 'lowpass').connect(comp));
  const bass = keep(
    new Tone.Synth({ oscillator: { type: v.bass }, envelope: env(0.01, 0.15, 0.6, 0.15), volume: v.db[2] }).connect(bassFilter),
  );

  const kick = keep(
    new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 6, envelope: env(0.001, 0.3, 0, 0.1), volume: v.db[3] + 2 }).connect(comp),
  );
  const snareFilter = keep(new Tone.Filter(2500, 'bandpass').connect(comp));
  const snare = keep(
    new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: env(0.001, 0.15, 0, 0.05), volume: v.db[3] - 2 }).connect(snareFilter),
  );
  const hatFilter = keep(new Tone.Filter(7000, 'highpass').connect(comp));
  const hat = keep(
    new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: env(0.001, 0.05, 0, 0.02), volume: v.db[3] - 8 }).connect(hatFilter),
  );

  const sparkle = keep(
    new Tone.Synth({ oscillator: { type: 'sine' }, envelope: env(0.02, 0.6, 0, 1.2), volume: -12 }).connect(reverb),
  );

  const freq = (midi: number) => Tone.Frequency(midi, 'midi').toFrequency();

  return {
    trigger(e, time, spb) {
      const dur = Math.max(0.03, e.dur * spb);
      switch (e.voice) {
        case 'lead': lead.triggerAttackRelease(freq(e.midi!), dur, time, e.vel); break;
        case 'pad': pad.triggerAttackRelease(freq(e.midi!), dur, time, e.vel); break;
        case 'bass': bass.triggerAttackRelease(freq(e.midi!), dur, time, e.vel); break;
        case 'sparkle': sparkle.triggerAttackRelease(freq(e.midi!), dur, time, e.vel); break;
        case 'kick': kick.triggerAttackRelease('C1', dur, time, e.vel); break;
        case 'snare': snare.triggerAttackRelease(dur, time, e.vel); break;
        case 'hat': hat.triggerAttackRelease(dur, time, e.vel); break;
      }
    },
    dispose() {
      for (const n of nodes) n.dispose();
    },
  };
}
