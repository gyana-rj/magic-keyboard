import type { GenreId } from '../music/types';

export interface Palette {
  /** Fill for contribution levels 0-4. */
  levels: [string, string, string, string, string];
  /** Playhead line and pulse glow. */
  accent: string;
}

export const PALETTES: Record<GenreId, Palette> = {
  lofi: { levels: ['#2b2833', '#4a3b2a', '#8a6233', '#d08a3c', '#f6b25a'], accent: '#ffe2b0' },
  synthwave: { levels: ['#261c45', '#4a1d6b', '#9b2a9c', '#e5439b', '#ff7ac6'], accent: '#5ff2ff' },
  chiptune: { levels: ['#1e2d25', '#1d5a2e', '#2f9a43', '#6fdc4f', '#c8ff6a'], accent: '#ffffff' },
  house: { levels: ['#2c2421', '#5a2a1c', '#a8401f', '#ec6a2a', '#ffa14d'], accent: '#fff1c2' },
  ambient: { levels: ['#192a3b', '#173f55', '#1f7a86', '#45b8b0', '#9be8d8'], accent: '#e8fffb' },
};
