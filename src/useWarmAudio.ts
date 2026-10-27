import { useEffect } from 'preact/hooks';
import { preloadAudio } from './music/player';

/**
 * Fetches the audio engine on the first touch or keypress. That is a user gesture, so the browser
 * doesn't warn about an audio context starting early, and it is usually ready before the first Play tap.
 */
export function useWarmAudio() {
  useEffect(() => {
    const warm = () => preloadAudio();
    const opts = { once: true, capture: true } as const;
    window.addEventListener('pointerdown', warm, opts);
    window.addEventListener('keydown', warm, opts);
    return () => {
      window.removeEventListener('pointerdown', warm, opts);
      window.removeEventListener('keydown', warm, opts);
    };
  }, []);
}
