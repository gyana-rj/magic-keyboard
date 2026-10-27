import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ContributionData } from '../../shared/types';
import { GENRES } from '../music/genres';
import { composeSong } from '../music/mapping';
import { createPlayer, type Player } from '../music/player';
import { keyName } from '../music/scales';
import { busiestWeek, longestStreak, weekRange } from '../stats';
import { BeatClock } from '../visual/clock';
import { PALETTES } from '../visual/palettes';
import { Visual } from '../visual/Visual';

interface Props {
  data: ContributionData;
  /** Start right away (audio was unlocked by the tap on "Play my year"). */
  autoplay: boolean;
  onBack: () => void;
}

type Status = 'idle' | 'starting' | 'playing' | 'ended' | 'failed';

export function PlayerView({ data, autoplay, onBack }: Props) {
  const song = useMemo(() => composeSong(data), [data]);
  const clock = useMemo(() => new BeatClock(song.bpm), [song]);
  const palette = PALETTES[song.genre];
  const genre = GENRES[song.genre];
  const player = useRef<Player | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [week, setWeek] = useState<number | null>(null);

  const busiest = useMemo(() => busiestWeek(data.weeks), [data]);
  const streak = useMemo(() => longestStreak(data.weeks, data.year), [data]);

  function stop() {
    player.current?.dispose();
    player.current = null;
    clock.reset();
    setWeek(null);
  }

  async function start() {
    stop();
    setStatus('starting');
    const p = createPlayer(song, {
      onBeat: (e) => {
        clock.sync(e.beat, performance.now());
        setWeek((prev) => (prev === e.week ? prev : e.week));
      },
      onEnd: () => {
        clock.reset();
        setWeek(null);
        setStatus('ended');
      },
    });
    player.current = p;
    try {
      await p.play();
      if (player.current === p) setStatus('playing');
    } catch {
      if (player.current === p) setStatus('failed');
    }
  }

  function toggle() {
    if (status === 'playing' || status === 'starting') {
      stop();
      setStatus('idle');
    } else {
      void start();
    }
  }

  useEffect(() => {
    if (autoplay) void start();
    return () => player.current?.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playing = status === 'playing' || status === 'starting';
  const label = playing ? 'Stop' : status === 'ended' ? 'Play again' : 'Play';
  const quiet = data.total === 0;

  return (
    <main class="player" style={{ '--accent': palette.accent, '--accent2': palette.levels[3] } as Record<string, string>}>
      <header class="bar">
        <button class="ghost" onClick={onBack}>
          ← Another year
        </button>
        <span class="pill">{genre.label}</span>
      </header>

      <h1 class="who">
        @{data.user} <span class="yr">{data.year}</span>
      </h1>

      {quiet && (
        <p class="note">
          A silent year, or at least a private one. Only public contributions show up here, so here is a gentle track
          for the quiet.
        </p>
      )}

      <section class="stage" aria-label="Contribution graph">
        <Visual data={data} song={song} clock={clock} playing={playing} />
        <p class="now" aria-live="off">
          {week !== null
            ? `Week ${week + 1} · ${weekRange(data.year, week)}`
            : status === 'ended'
              ? 'That was your year.'
              : status === 'failed'
                ? "Couldn't start the audio. Tap Play to try again."
                : playing
                  ? 'Here we go…'
                  : 'Tap play to hear it.'}
        </p>
      </section>

      <button class={`cta play ${playing ? 'on' : ''}`} onClick={toggle} aria-pressed={playing}>
        {playing ? (
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 4.5v15l13-7.5z" fill="currentColor" />
          </svg>
        )}
        {label}
      </button>

      <dl class="stats">
        <div>
          <dt>Contributions</dt>
          <dd>{data.total.toLocaleString()}</dd>
          <small>in {data.year}</small>
        </div>
        <div>
          <dt>Busiest week</dt>
          <dd>{busiest ? weekRange(data.year, busiest.week) : '—'}</dd>
          <small>{busiest ? `week ${busiest.week + 1}` : 'no activity'}</small>
        </div>
        <div>
          <dt>Longest streak</dt>
          <dd>
            {streak} {streak === 1 ? 'day' : 'days'}
          </dd>
          <small>in a row</small>
        </div>
        <div>
          <dt>Genre</dt>
          <dd>{genre.label}</dd>
          <small>
            {keyName(song.rootPc)} {song.mode} · {song.bpm} BPM
          </small>
        </div>
      </dl>
    </main>
  );
}
