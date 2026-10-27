import { useRef, useState } from 'preact/hooks';
import type { ContributionData } from '../shared/types';
import { ContributionsError, loadContributions } from './api';
import { unlockAudio } from './music/player';
import { ErrorView } from './views/ErrorView';
import { Landing } from './views/Landing';
import { Loading } from './views/Loading';
import { PlayerView } from './views/PlayerView';

type View =
  | { kind: 'landing' }
  | { kind: 'loading'; user: string; year: number }
  | { kind: 'player'; data: ContributionData; autoplay: boolean }
  | { kind: 'error'; user: string; year: number; error: ContributionsError };

export function App() {
  const [view, setView] = useState<View>({ kind: 'landing' });
  const last = useRef({ user: '', year: new Date().getFullYear() });
  const run = useRef<AbortController | null>(null);

  /** Runs inside the tap on "Play my year": unlock audio right now, then fetch while it settles. */
  function go(user: string, year: number) {
    last.current = { user, year };
    const unlocked = unlockAudio(); // must start inside the gesture; not awaited so the fetch isn't delayed
    run.current?.abort();
    const ctl = (run.current = new AbortController());
    setView({ kind: 'loading', user, year });

    loadContributions(user, year, ctl.signal)
      .then(async (data) => {
        const ok = await unlocked;
        if (ctl.signal.aborted) return;
        // If the browser refused to unlock audio, show the player and wait for an explicit Play tap.
        setView({ kind: 'player', data, autoplay: ok });
      })
      .catch((err) => {
        if (ctl.signal.aborted) return;
        const error = err instanceof ContributionsError ? err : new ContributionsError('upstream_error', 'Unexpected error');
        setView({ kind: 'error', user, year, error });
      });
  }

  function back() {
    run.current?.abort();
    setView({ kind: 'landing' });
  }

  return (
    <>
      <div class="backdrop" aria-hidden="true" />
      {view.kind === 'landing' && <Landing initialUser={last.current.user} initialYear={last.current.year} onPlay={go} />}
      {view.kind === 'loading' && <Loading user={view.user} onCancel={back} />}
      {view.kind === 'error' && (
        <ErrorView error={view.error} user={view.user} onRetry={() => go(view.user, view.year)} onBack={back} />
      )}
      {view.kind === 'player' && <PlayerView key={`${view.data.user}:${view.data.year}`} data={view.data} autoplay={view.autoplay} onBack={back} />}
    </>
  );
}
