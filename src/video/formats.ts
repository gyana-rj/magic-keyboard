/**
 * Video export uses MediaRecorder on a canvas stream plus the Web Audio graph (the most widely supported way to make a
 * video in the browser). What it can write differs by browser, so the container is negotiated at runtime:
 *   - MP4 (H.264 + AAC): Safari 14.1+, and Chrome 126+ only where the OS has an H.264 encoder. Never Firefox.
 *   - WebM (VP9/VP8 + Opus): Chrome, Edge, Firefox, and Safari 18.4+.
 * MP4 is preferred because Instagram and X want it; WebM is the dependable fallback.
 */
export interface VideoFormat {
  /** Full MIME type handed to MediaRecorder. */
  mime: string;
  container: 'mp4' | 'webm';
}

/**
 * MP4 is only offered with explicit H.264 + AAC. A bare `video/mp4` is deliberately NOT a candidate: some Chromium builds
 * say yes to it and then write VP9 + Opus into the MP4, which Instagram and X reject.
 */
export const VIDEO_CANDIDATES: VideoFormat[] = [
  { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', container: 'mp4' },
  { mime: 'video/mp4;codecs=avc1,mp4a.40.2', container: 'mp4' },
  { mime: 'video/webm;codecs=vp9,opus', container: 'webm' },
  { mime: 'video/webm;codecs=vp8,opus', container: 'webm' },
  { mime: 'video/webm', container: 'webm' },
];

/** The first candidate the browser can record, or null. */
export function pickVideoFormat(isSupported: (mime: string) => boolean): VideoFormat | null {
  return VIDEO_CANDIDATES.find((c) => isSupported(c.mime)) ?? null;
}

/** Can this browser record a canvas + audio at all? Cheap to call; the heavy code is not loaded for it. */
export function videoFormatForBrowser(env: Pick<typeof globalThis, 'MediaRecorder' | 'HTMLCanvasElement'> = globalThis): VideoFormat | null {
  const MR = env.MediaRecorder;
  const canvas = env.HTMLCanvasElement?.prototype as { captureStream?: unknown } | undefined;
  if (typeof MR === 'undefined' || typeof MR.isTypeSupported !== 'function' || typeof canvas?.captureStream !== 'function') return null;
  return pickVideoFormat((m) => MR.isTypeSupported(m));
}

export const UNSUPPORTED_NOTICE =
  "Video export isn't supported in this browser. Try Chrome, Edge, Firefox or Safari on a computer, or use the image and WAV downloads.";

/** A message to show next to the finished file when the container may not suit every platform. */
export function formatNotice(f: VideoFormat): string | null {
  return f.container === 'webm'
    ? "This browser saved a WebM video. YouTube Shorts accepts it; Instagram and X want MP4, so convert it first (for example with HandBrake, CloudConvert or `ffmpeg -i in.webm out.mp4`), or export from Safari or a recent Chrome with MP4 support."
    : null;
}

export function videoFilename(user: string, year: number, f: VideoFormat): string {
  return `commit-symphony-${user.toLowerCase()}-${year}.${f.container}`;
}

export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const VIDEO_FPS = 30;
