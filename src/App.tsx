import { useEffect, useRef, useState } from 'preact/hooks';
import type { ContributionData } from '../shared/types';
import { ContributionsError, loadContributions } from './api';
import { unlockAudio } from './music/audio';
import { parseShareLocation, sharePath } from './url';
import { ErrorView } from './views/ErrorView';
import { Landing } from './views/Landing';
import { Loading } from './views/Loading';

/** The player (graph, music code, share panel) is its own chunk, fetched alongside the data. */
const loadPlayerView = () => import('./views/PlayerView');
type PlayerViewComponent = Awaited<ReturnType<typeof loadPlayerView>>['PlayerView'];

type View =
  | { kind: 'landing' }
  | { kind: 'loading'; user: string; year: number }
  | { kind: 'player'; data: ContributionData; autoplay: boolean; Player: PlayerViewComponent }
  | { kind: 'error'; user: string; year: number; error: ContributionsError };

const fromUrl = () => parseShareLocation(location);

export function App() {
  const initial = useRef(fromUrl()); // a shared link opens straight into loading, no landing flash
  const [view, setView] = useState<View>(
    initial.current ? { kind: 'loading', ...initial.current } : { kind: 'landing' },
  );
  const last = useRef(initial.current ?? { user: '', year: new Date().getFullYear() });
  const run = useRef<AbortController | null>(null);

  /**
   * Fetch a year and show the player. From the "Play my year" tap (`tap: true`) audio is unlocked inside
   * the gesture and playback starts on arrival. From a shared link there is no gesture, so the player
   * waits for an explicit Play tap.
   */
  function go(user: string, year: number, tap: boolean) {
    last.current = { user, year };
    const unlocked = tap ? unlockAudio() : Promise.resolve(false); // must start inside the gesture
    run.current?.abort();
    const ctl = (run.current = new AbortController());
    setView({ kind: 'loading', user, year });

    Promise.all([loadContributions(user, year, ctl.signal), loadPlayerView()])
      .then(async ([data, { PlayerView: Player }]) => {
        const ok = await unlocked;
        if (ctl.signal.aborted) return;
        const path = sharePath(data.user, data.year);
        if (location.pathname + location.search !== path) {
          // A tap adds a history entry so Back returns to the landing page; a link already is the entry.
          (tap ? history.pushState : history.replaceState).call(history, null, '', path);
        }
        setView({ kind: 'player', data, autoplay: ok, Player });
      })
      .catch((err) => {
        if (ctl.signal.aborted) return;
        const error = err instanceof ContributionsError ? err : new ContributionsError('upstream_error', 'Unexpected error');
        setView({ kind: 'error', user, year, error });
      });
  }

  function back() {
    run.current?.abort();
    if (location.pathname !== '/' || location.search) history.pushState(null, '', '/');
    setView({ kind: 'landing' });
  }

  useEffect(() => {
    if (initial.current) go(initial.current.user, initial.current.year, false);
    // Browser Back/Forward between landing and shared-link URLs.
    const onPop = () => {
      const p = fromUrl();
      if (p) go(p.user, p.year, false);
      else {
        run.current?.abort();
        setView({ kind: 'landing' });
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div class="backdrop" aria-hidden="true" />
      {view.kind === 'landing' && (
        <Landing initialUser={last.current.user} initialYear={last.current.year} onPlay={(u, y) => go(u, y, true)} />
      )}
      {view.kind === 'loading' && <Loading user={view.user} onCancel={back} />}
      {view.kind === 'error' && (
        <ErrorView error={view.error} user={view.user} onRetry={() => go(view.user, view.year, true)} onBack={back} />
      )}
      {view.kind === 'player' && (
        <view.Player key={`${view.data.user}:${view.data.year}`} data={view.data} autoplay={view.autoplay} onBack={back} />
      )}
    </>
  );
}
