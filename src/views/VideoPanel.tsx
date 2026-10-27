import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ContributionData } from '../../shared/types';
import { unlockAudio } from '../music/audio';
import type { Song } from '../music/types';
import { downloadBlob } from '../share/actions';
import { UNSUPPORTED_NOTICE, VIDEO_HEIGHT, VIDEO_WIDTH, formatNotice, videoFilename, videoFormatForBrowser, type VideoFormat } from '../video/formats';

interface Props {
  data: ContributionData;
  song: Song;
  /** Stop the on-page player before recording (they share one audio engine). */
  onStart: () => void;
  onBusyChange: (busy: boolean) => void;
}

type State =
  | { kind: 'idle' }
  | { kind: 'recording'; progress: number }
  | { kind: 'done'; src: string; blob: Blob; format: VideoFormat; seconds: number }
  | { kind: 'error'; message: string };

const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;

/** Optional video export. The recording code is a separate chunk that is only fetched when the button is pressed. */
export function VideoPanel({ data, song, onStart, onBusyChange }: Props) {
  const supported = useMemo(() => videoFormatForBrowser(), []);
  // People who asked for less motion don't get an animated preview while recording (the file is unaffected).
  const calm = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const preview = useRef<HTMLCanvasElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    onBusyChange(state.kind === 'recording');
    if (state.kind !== 'recording') return;
    // Recording is real time and draws on the page: if the tab is hidden the frames would freeze, so stop.
    const hidden = () => document.hidden && abort.current?.abort();
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, [state.kind]);
  useEffect(() => () => state.kind === 'done' && URL.revokeObjectURL(state.src), [state]);

  if (!supported) {
    return (
      <div class="video">
        <h3>Video</h3>
        <p class="hint" role="note">{UNSUPPORTED_NOTICE}</p>
      </div>
    );
  }

  async function start() {
    void unlockAudio(); // inside the tap, before any await: Safari only resumes audio from within the gesture
    onStart();
    const ctl = (abort.current = new AbortController());
    setState({ kind: 'recording', progress: 0 });
    try {
      const { exportVideo } = await import('../video/export');
      const r = await exportVideo({
        data,
        song,
        host: location.host,
        preview: calm ? null : preview.current,
        signal: ctl.signal,
        onProgress: (progress) => setState({ kind: 'recording', progress }),
      });
      setState({ kind: 'done', src: URL.createObjectURL(r.blob), blob: r.blob, format: r.format, seconds: r.seconds });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setState({ kind: 'idle' });
      } else {
        setState({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong while recording.' });
      }
    }
  }

  const recording = state.kind === 'recording';
  return (
    <div class="video">
      <h3>
        Video <span class="beta">beta</span>
      </h3>

      {state.kind === 'idle' && (
        <>
          <p class="hint">A vertical {VIDEO_WIDTH}×{VIDEO_HEIGHT} video of your graph lighting up with the song, for Reels, Shorts and X. It records in real time (about 30 seconds), so keep this tab open.</p>
          <button class="ghost" onClick={start}>
            Create video
          </button>
        </>
      )}

      {(recording || state.kind === 'done') && (
        <div class="video-stage">
          <canvas
            ref={preview}
            width={VIDEO_WIDTH / 4}
            height={VIDEO_HEIGHT / 4}
            hidden={state.kind === 'done' || calm}
            aria-label="Video being recorded"
          />
          {state.kind === 'done' && <video src={state.src} controls playsInline width={VIDEO_WIDTH / 4} height={VIDEO_HEIGHT / 4} />}
        </div>
      )}

      {recording && (
        <>
          <div class="bar-track" role="progressbar" aria-label="Recording video" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.progress * 100)}>
            <div class="bar-fill" style={{ width: `${Math.round(state.progress * 100)}%` }} />
          </div>
          <p class="hint">Recording… keep this tab visible. The song plays while it records.</p>
          <button class="ghost" onClick={() => abort.current?.abort()}>
            Cancel
          </button>
        </>
      )}

      {state.kind === 'done' && (
        <>
          <p class="hint">
            Ready: {state.format.container.toUpperCase()}, {mb(state.blob.size)}.
          </p>
          {formatNotice(state.format) && <p class="hint warn" role="note">{formatNotice(state.format)}</p>}
          <div class="row start">
            <button class="cta small" onClick={() => downloadBlob(state.blob, videoFilename(data.user, data.year, state.format))}>
              Download video
            </button>
            <button class="ghost" onClick={() => setState({ kind: 'idle' })}>
              Record again
            </button>
          </div>
        </>
      )}

      {state.kind === 'error' && (
        <>
          <p class="hint warn" role="alert">{state.message}</p>
          <button class="ghost" onClick={() => setState({ kind: 'idle' })}>
            Try again
          </button>
        </>
      )}
    </div>
  );
}
