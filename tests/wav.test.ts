import { describe, expect, it } from 'vitest';
import { encodeWav } from '../src/music/wav';
import { shareLinks } from '../src/share/links';

const ascii = (v: DataView, at: number, n: number) => String.fromCharCode(...Array.from({ length: n }, (_, i) => v.getUint8(at + i)));

describe('encodeWav', () => {
  const left = Float32Array.from([0, 0.5, -0.5, 1]);
  const right = Float32Array.from([1, -1, 0.25, 0]);
  const buf = encodeWav([left, right], 44100);
  const v = new DataView(buf);

  it('writes a valid 16-bit stereo PCM header', () => {
    expect(ascii(v, 0, 4)).toBe('RIFF');
    expect(ascii(v, 8, 4)).toBe('WAVE');
    expect(ascii(v, 12, 4)).toBe('fmt ');
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(2); // channels
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint32(28, true)).toBe(44100 * 2 * 2); // byte rate
    expect(v.getUint16(32, true)).toBe(4); // block align
    expect(v.getUint16(34, true)).toBe(16);
    expect(ascii(v, 36, 4)).toBe('data');
    expect(v.getUint32(40, true)).toBe(4 * 2 * 2);
    expect(v.getUint32(4, true)).toBe(buf.byteLength - 8);
    expect(buf.byteLength).toBe(44 + 16);
  });
  it('interleaves channels and scales samples to 16-bit', () => {
    const s = (i: number) => v.getInt16(44 + i * 2, true);
    expect([s(0), s(1)]).toEqual([0, 32767]); // frame 0: L=0, R=1
    expect([s(2), s(3)]).toEqual([16384, -32768]); // frame 1: L=.5, R=-1
    expect([s(4), s(5)]).toEqual([-16384, 8192]);
    expect(s(6)).toBe(32767);
  });
  it('clips out-of-range samples instead of wrapping', () => {
    const w = new DataView(encodeWav([Float32Array.from([2, -2, NaN as number])], 8000));
    expect(w.getInt16(44, true)).toBe(32767);
    expect(w.getInt16(46, true)).toBe(-32768);
    expect(Number.isFinite(w.getInt16(48, true))).toBe(true);
  });
  it('supports mono and rejects no channels', () => {
    const m = new DataView(encodeWav([Float32Array.of(0.1, 0.2)], 22050));
    expect(m.getUint16(22, true)).toBe(1);
    expect(m.getUint16(32, true)).toBe(2);
    expect(() => encodeWav([], 44100)).toThrow();
  });
  it('a 31-second stereo render is a sensible size', () => {
    const frames = 31 * 44100;
    const big = encodeWav([new Float32Array(frames), new Float32Array(frames)], 44100);
    expect(big.byteLength).toBe(44 + frames * 4);
  });
});

describe('shareLinks', () => {
  const l = shareLinks('My 2025 as a song & more', 'https://s.example/u/a/2025');
  it('builds web-intent URLs with encoded text and link', () => {
    expect(l.x).toBe('https://x.com/intent/post?text=My%202025%20as%20a%20song%20%26%20more&url=https%3A%2F%2Fs.example%2Fu%2Fa%2F2025');
    expect(l.linkedin).toBe('https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fs.example%2Fu%2Fa%2F2025');
    expect(l.whatsapp).toBe('https://wa.me/?text=My%202025%20as%20a%20song%20%26%20more%20https%3A%2F%2Fs.example%2Fu%2Fa%2F2025');
  });
  it('cannot be broken out of by hostile text', () => {
    const evil = shareLinks('a&url=http://evil', 'https://s.example/');
    expect(new URL(evil.x).searchParams.getAll('url')).toEqual(['https://s.example/']);
  });
});
