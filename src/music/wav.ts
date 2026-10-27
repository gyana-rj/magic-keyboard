/** Encodes PCM channels (floats in -1..1) as a 16-bit little-endian WAV file. */
export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const n = channels.length;
  const frames = channels[0]?.length ?? 0;
  if (n === 0) throw new Error('encodeWav needs at least one channel');
  const bytes = frames * n * 2;
  const buf = new ArrayBuffer(44 + bytes);
  const v = new DataView(buf);
  const str = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));

  str(0, 'RIFF');
  v.setUint32(4, 36 + bytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true); // PCM chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, n, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * n * 2, true); // byte rate
  v.setUint16(32, n * 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  str(36, 'data');
  v.setUint32(40, bytes, true);

  let at = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < n; c++) {
      const x = Math.max(-1, Math.min(1, channels[c]![i] ?? 0));
      v.setInt16(at, x < 0 ? Math.round(x * 32768) : Math.round(x * 32767), true);
      at += 2;
    }
  }
  return buf;
}
