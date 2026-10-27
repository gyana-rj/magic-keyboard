// TEMPORARY dev page for listening to songs: open /dev-music.html while `npm run dev` runs.
// Not part of the production build (only index.html is an entry). Delete once the real UI plays songs.
import { render } from 'preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import type { ContributionData } from '../../shared/types';
import { GENRES } from '../music/genres';
import { composeSong, maxPolyphony, songSeconds } from '../music/mapping';
import { createPlayer, type Player } from '../music/player';
import { keyName } from '../music/scales';
import '../style.css';

const fixtures = Object.fromEntries(
  Object.entries(import.meta.glob('../../fixtures/*.json', { eager: true, import: 'default' })).map(([path, data]) => [
    path.split('/').pop()!.replace('.json', ''),
    data as ContributionData,
  ]),
);

function Dev() {
  const [name, setName] = useState(Object.keys(fixtures)[0]!);
  const [user, setUser] = useState(fixtures[name]!.user);
  const [year, setYear] = useState(fixtures[name]!.year);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState<{ beat: number; week: number | null } | null>(null);
  const player = useRef<Player | null>(null);

  const song = useMemo(() => composeSong({ ...fixtures[name]!, user, year }), [name, user, year]);

  function stop() {
    player.current?.dispose();
    player.current = null;
    setPlaying(false);
    setBeat(null);
  }

  async function play() {
    stop();
    const p = createPlayer(song, {
      onBeat: (e) => setBeat({ beat: e.beat, week: e.week }),
      onEnd: () => {
        setPlaying(false);
        setBeat(null);
      },
    });
    player.current = p;
    setPlaying(true);
    await p.play();
  }

  const pick = (n: string) => {
    stop();
    setName(n);
    setUser(fixtures[n]!.user);
    setYear(fixtures[n]!.year);
  };

  return (
    <main>
      <h1>Music dev page</h1>
      <form onSubmit={(e) => e.preventDefault()}>
        <select value={name} onChange={(e) => pick(e.currentTarget.value)} aria-label="Fixture">
          {Object.keys(fixtures).map((n) => (
            <option value={n}>{n}</option>
          ))}
        </select>
        <input value={user} onInput={(e) => (stop(), setUser(e.currentTarget.value))} aria-label="Username (changes the seed)" />
        <input type="number" value={year} onInput={(e) => (stop(), setYear(Number(e.currentTarget.value)))} aria-label="Year" />
        <button onClick={playing ? stop : play}>{playing ? 'Stop' : 'Play'}</button>
      </form>
      <p>
        {GENRES[song.genre].label} · {keyName(song.rootPc)} {song.mode} · {song.bpm} BPM · {songSeconds(song).toFixed(1)}s ·{' '}
        {song.events.length} events · max {maxPolyphony(song)} voices · seed {song.seed}
      </p>
      <p>{beat ? `beat ${beat.beat}${beat.week !== null ? ` · week ${beat.week + 1}` : ''}` : 'stopped'}</p>
      <div class="grid" aria-hidden="true">
        {fixtures[name]!.weeks.map((week, w) => (
          <div class="col" style={{ outline: beat?.week === w ? '1px solid #fff' : 'none' }}>
            {week.map((level) => (
              <span class={`cell l${level}`} />
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}

render(<Dev />, document.getElementById('app')!);
