import { songSeconds } from './mapping';
import { loadToneLib } from './audio';
import { buildRig, type Rig, type ToneLib } from './instruments';
import type { Song } from './types';

export interface BeatEvent {
  /** Beat index from the start of the song, intro included. */
  beat: number;
  phase: 'intro' | 'week' | 'outro';
  /** 0-51 during the 52 contribution weeks, otherwise null. */
  week: number | null;
  /** Audio-context time the beat sounds at. */
  time: number;
}

export interface PlayerHandlers {
  /** Fires once per beat, synced to the audio via Tone's Draw (use it to drive visuals). */
  onBeat?: (e: BeatEvent) => void;
  /** Fires when the song finishes on its own (not on stop()). */
  onEnd?: () => void;
}

export interface Player {
  /** Must be called from a user gesture (browsers block audio otherwise). */
  play(): Promise<void>;
  stop(): void;
  dispose(): void;
  readonly playing: boolean;
}

export function beatInfo(song: Song, beat: number): Pick<BeatEvent, 'phase' | 'week'> {
  if (beat < song.introBeats) return { phase: 'intro', week: null };
  const week = beat - song.introBeats;
  return week < song.weekBeats ? { phase: 'week', week } : { phase: 'outro', week: null };
}

/** Schedules every event and per-beat callback on the current Tone transport. */
function schedule(Tone: ToneLib, song: Song, rig: Rig, onBeat: (e: BeatEvent) => void, onEnd: (time: number) => void) {
  const transport = Tone.getTransport();
  const draw = Tone.getDraw();
  const ticks = (beat: number) => `${Math.round(beat * transport.PPQ)}i`;
  const spb = 60 / song.bpm;

  for (const e of song.events) transport.schedule((time) => rig.trigger(e, time, spb), ticks(e.beat));
  for (let beat = 0; beat < song.totalBeats; beat++) {
    transport.schedule((time) => draw.schedule(() => onBeat({ beat, ...beatInfo(song, beat), time }), time), ticks(beat));
  }
  transport.schedule(onEnd, ticks(songSeconds(song) / spb));
}

export function createPlayer(song: Song, handlers: PlayerHandlers = {}): Player {
  let rig: Rig | null = null;
  let playing = false;
  let token = 0; // invalidates a play() that is still loading when stop() is called

  function teardown(Tone: ToneLib) {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    rig?.dispose();
    rig = null;
    playing = false;
  }

  return {
    get playing() {
      return playing;
    },
    async play() {
      const mine = ++token;
      const Tone = await loadToneLib(); // lazy: keeps Tone.js out of the startup bundle
      await Tone.start();
      if (mine !== token) return;
      teardown(Tone);
      const built = await buildRig(Tone, song.genre);
      if (mine !== token) {
        built.dispose();
        return;
      }
      rig = built;
      const transport = Tone.getTransport();
      transport.bpm.value = song.bpm;
      schedule(
        Tone,
        song,
        built,
        (e) => handlers.onBeat?.(e),
        (time) =>
          Tone.getDraw().schedule(() => {
            if (mine !== token) return;
            teardown(Tone);
            handlers.onEnd?.();
          }, time),
      );
      playing = true;
      transport.start('+0.1');
    },
    stop() {
      token++;
      if (!playing) return;
      void loadToneLib().then((Tone) => teardown(Tone));
    },
    dispose() {
      this.stop();
    },
  };
}

/** Renders the song to an AudioBuffer without playing it (tests, future audio download). */
export async function renderSong(song: Song): Promise<AudioBuffer> {
  const Tone = await loadToneLib();
  const buffer = await Tone.Offline(async () => {
    const rig = await buildRig(Tone, song.genre);
    const transport = Tone.getTransport();
    transport.bpm.value = song.bpm;
    schedule(Tone, song, rig, () => {}, () => {});
    transport.start(0);
  }, songSeconds(song) + 1);
  return buffer.get() as AudioBuffer;
}
