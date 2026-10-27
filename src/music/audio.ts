import type { ToneLib } from './instruments';

// Kept apart from player.ts so the landing page can unlock audio without downloading the player.

let tone: Promise<ToneLib> | null = null;
/** Tone.js is a separate chunk, loaded once, on demand. Also used by code that needs the audio graph (video export). */
export const loadToneLib = (): Promise<ToneLib> => (tone ??= import('tone'));
let toneReady: ToneLib | null = null;

/** Warm the Tone.js chunk (call on a user gesture) so the first tap doesn't wait on the network. */
export function preloadAudio(): void {
  void loadToneLib().then((t) => (toneReady = t));
}

/**
 * Resume the browser's audio context. Call it directly inside a tap/click handler: when Tone is
 * already preloaded this runs synchronously within the gesture, which iOS Safari requires.
 * Resolves true if audio is allowed to play.
 */
export async function unlockAudio(): Promise<boolean> {
  try {
    const Tone = toneReady ?? (await loadToneLib());
    toneReady = Tone;
    await Tone.start();
    return Tone.getContext().state === 'running';
  } catch {
    return false;
  }
}
