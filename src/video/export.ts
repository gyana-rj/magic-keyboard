import type { ContributionData } from '../../shared/types';
import { loadToneLib, unlockAudio } from '../music/audio';
import { createPlayer } from '../music/player';
import type { Song } from '../music/types';
import { renderCard, gridBox } from '../share/card';
import { BeatClock } from '../visual/clock';
import { drawFrame } from '../visual/draw';
import { GridScene } from '../visual/scene';
import { VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH, videoFormatForBrowser, type VideoFormat } from './formats';

export interface ExportOptions {
  data: ContributionData;
  song: Song;
  host: string;
  /** Optional on-screen canvas the frames are mirrored to (as the live preview). */
  preview?: HTMLCanvasElement | null;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  format: VideoFormat;
  seconds: number;
}

export class VideoExportError extends Error {}

/**
 * Records the story card with the animated graph and the song into a vertical 1080x1920 video.
 *
 * It plays the song once, in real time, and records two streams: a canvas that is redrawn every frame from the same
 * GridScene the page uses, and the song's own audio graph (tapped at Tone's output, not the microphone). So it takes about
 * as long as the song, and the tab has to stay visible while it runs.
 */
export async function exportVideo(opts: ExportOptions): Promise<ExportResult> {
  const { data, song, host, signal } = opts;
  const format = videoFormatForBrowser();
  if (!format) throw new VideoExportError('Video export is not supported in this browser.');
  if (!(await unlockAudio())) throw new VideoExportError('The browser did not allow audio. Tap the button again.');
  const Tone = await loadToneLib();
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');

  // Frame source: a static story card (everything but the graph) plus the animated graph on top.
  const canvas = document.createElement('canvas');
  canvas.width = VIDEO_WIDTH;
  canvas.height = VIDEO_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  const background = renderCard(data, song, host, 'story', { grid: false });
  const box = gridBox('story');
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = box.layout.width;
  gridCanvas.height = box.layout.height;
  const gridCtx = gridCanvas.getContext('2d')!;
  const scene = new GridScene(data, song);
  const clock = new BeatClock(song.bpm);

  const previewCtx = opts.preview?.getContext('2d') ?? null;
  let raf = 0;
  const paint = () => {
    const now = performance.now();
    const beat = clock.beatAt(now) ?? -1;
    drawFrame(gridCtx, scene.frame(box.layout, beat, now, false));
    ctx.drawImage(background, 0, 0);
    ctx.drawImage(gridCanvas, box.x, box.y);
    previewCtx?.drawImage(canvas, 0, 0, opts.preview!.width, opts.preview!.height);
    raf = requestAnimationFrame(paint);
  };

  // Audio source: Tone's master output, mirrored into a MediaStream (the speakers keep playing too).
  const rawContext = Tone.getContext().rawContext as unknown as AudioContext;
  const audioOut = rawContext.createMediaStreamDestination();
  const master = Tone.getDestination();
  master.connect(audioOut as unknown as AudioNode);

  const stream = canvas.captureStream(VIDEO_FPS);
  audioOut.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 128_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);

  const startedAt = performance.now();
  let player: ReturnType<typeof createPlayer> | null = null;
  const cleanup = () => {
    cancelAnimationFrame(raf);
    player?.dispose();
    try {
      master.disconnect(audioOut as unknown as AudioNode);
    } catch {
      /* already disconnected */
    }
    stream.getTracks().forEach((t) => t.stop());
  };

  return new Promise<ExportResult>((resolve, reject) => {
    const fail = (err: unknown) => {
      cleanup();
      if (recorder.state !== 'inactive') recorder.stop();
      reject(err);
    };
    signal?.addEventListener('abort', () => fail(new DOMException('Cancelled', 'AbortError')), { once: true });
    recorder.onerror = () => fail(new VideoExportError('The browser could not record the video.'));
    recorder.onstop = async () => {
      if (signal?.aborted) return;
      cleanup();
      const seconds = (performance.now() - startedAt) / 1000;
      let blob = new Blob(chunks, { type: format.mime.split(';')[0] });
      if (format.container === 'webm') {
        // Chrome's WebM has no duration or seek index; patch it so players and uploaders can seek.
        try {
          const { default: fixWebmDuration } = await import('fix-webm-duration');
          blob = await fixWebmDuration(blob, Math.round(seconds * 1000), { logger: false });
        } catch {
          /* the unpatched file still plays */
        }
      }
      resolve({ blob, format, seconds });
    };

    player = createPlayer(song, {
      onBeat: (e) => {
        clock.sync(e.beat, performance.now());
        opts.onProgress?.(Math.min(1, (e.beat + 1) / song.totalBeats));
      },
      onEnd: () => {
        opts.onProgress?.(1);
        // hold the last frame for a moment, then stop recording
        setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), 900);
      },
    });
    paint();
    recorder.start(1000);
    player.play().catch(fail);
  });
}
