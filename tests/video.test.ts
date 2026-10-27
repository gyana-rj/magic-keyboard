import { describe, expect, it } from 'vitest';
import { UNSUPPORTED_NOTICE, VIDEO_CANDIDATES, formatNotice, pickVideoFormat, videoFilename, videoFormatForBrowser } from '../src/video/formats';

const only = (...supported: string[]) => (mime: string) => supported.includes(mime);

describe('pickVideoFormat', () => {
  it('prefers MP4 (what Instagram and X want) when the browser can record it', () => {
    const f = pickVideoFormat(only('video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/webm;codecs=vp9,opus'))!;
    expect(f.container).toBe('mp4');
  });
  it('falls back to WebM VP9, then VP8, then plain WebM (Chrome without an H.264 encoder, Firefox)', () => {
    expect(pickVideoFormat(only('video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus'))!.mime).toBe('video/webm;codecs=vp9,opus');
    expect(pickVideoFormat(only('video/webm;codecs=vp8,opus'))!.mime).toBe('video/webm;codecs=vp8,opus');
    expect(pickVideoFormat(only('video/webm'))!.container).toBe('webm');
  });
  it('never picks a bare video/mp4, which can hold VP9 + Opus instead of H.264 + AAC', () => {
    expect(pickVideoFormat(only('video/mp4'))).toBeNull();
    expect(pickVideoFormat(only('video/mp4', 'video/webm;codecs=vp9,opus'))!.container).toBe('webm');
    for (const c of VIDEO_CANDIDATES) if (c.container === 'mp4') expect(c.mime).toMatch(/avc1.*mp4a\.40\.2/);
  });
  it('is null when nothing can be recorded', () => {
    expect(pickVideoFormat(() => false)).toBeNull();
  });
  it('every candidate carries audio and a recognizable container', () => {
    for (const c of VIDEO_CANDIDATES) {
      expect(c.mime.startsWith(`video/${c.container}`)).toBe(true);
      if (c.mime.includes('codecs=')) expect(c.mime).toMatch(/opus|mp4a/);
    }
  });
});

describe('videoFormatForBrowser', () => {
  const canvasWith = (captureStream: unknown) => ({ prototype: { captureStream } }) as unknown as typeof HTMLCanvasElement;
  const recorder = (supported: string[]) => Object.assign(function () {}, { isTypeSupported: (m: string) => supported.includes(m) }) as unknown as typeof MediaRecorder;

  it('works when MediaRecorder and canvas.captureStream exist', () => {
    const f = videoFormatForBrowser({ MediaRecorder: recorder(['video/webm;codecs=vp8,opus']), HTMLCanvasElement: canvasWith(() => {}) });
    expect(f?.container).toBe('webm');
  });
  it('is null without MediaRecorder (old browsers), without captureStream, or with no supported type', () => {
    expect(videoFormatForBrowser({ MediaRecorder: undefined as never, HTMLCanvasElement: canvasWith(() => {}) })).toBeNull();
    expect(videoFormatForBrowser({ MediaRecorder: recorder(['video/webm']), HTMLCanvasElement: canvasWith(undefined) })).toBeNull();
    expect(videoFormatForBrowser({ MediaRecorder: recorder([]), HTMLCanvasElement: canvasWith(() => {}) })).toBeNull();
  });
});

describe('messages', () => {
  it('warns about WebM but not MP4, and says what to do', () => {
    const webm = formatNotice({ mime: 'video/webm', container: 'webm' })!;
    expect(webm).toMatch(/WebM/);
    expect(webm).toMatch(/Instagram and X want MP4/);
    expect(webm).toMatch(/ffmpeg/);
    expect(formatNotice({ mime: 'video/mp4', container: 'mp4' })).toBeNull();
  });
  it('the unsupported message points at alternatives', () => {
    expect(UNSUPPORTED_NOTICE).toMatch(/Chrome|Firefox|Safari/);
    expect(UNSUPPORTED_NOTICE).toMatch(/image|WAV/);
  });
  it('names the file by container', () => {
    expect(videoFilename('OctoCat', 2025, { mime: 'video/webm', container: 'webm' })).toBe('commit-symphony-octocat-2025.webm');
    expect(videoFilename('OctoCat', 2025, { mime: 'video/mp4', container: 'mp4' })).toBe('commit-symphony-octocat-2025.mp4');
  });
});
