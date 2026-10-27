import { useState } from 'preact/hooks';
import { isValidUsername } from '../../server/validate';
import { useWarmAudio } from '../useWarmAudio';
import { Mark } from './Mark';

interface Props {
  initialUser?: string;
  initialYear?: number;
  /** Called synchronously from the submit tap, so the app can unlock audio inside the gesture. */
  onPlay: (user: string, year: number) => void;
}

export function Landing({ initialUser = '', initialYear, onPlay }: Props) {
  const thisYear = new Date().getFullYear();
  const [user, setUser] = useState(initialUser);
  const [year, setYear] = useState(initialYear ?? thisYear);
  const [problem, setProblem] = useState<string | null>(null);

  useWarmAudio();

  function submit(e: Event) {
    e.preventDefault();
    const name = user.trim().replace(/^@/, '');
    if (!name) return setProblem('Type a GitHub username to get started.');
    if (!isValidUsername(name)) return setProblem('Usernames are letters, numbers and single hyphens (max 39).');
    setProblem(null);
    onPlay(name, year);
  }

  const years = Array.from({ length: thisYear - 2008 + 1 }, (_, i) => thisYear - i);

  return (
    <main class="landing">
      <p class="brand">
        <Mark /> Commit Symphony
      </p>
      <h1>
        Your year in code,
        <br />
        <span class="grad">as a song.</span>
      </h1>
      <p class="pitch">
        We turn your contribution graph into a 30-second track and light it up as it plays. Free, open source, for GitHub
        users.
      </p>

      <form class="entry" onSubmit={submit} noValidate>
        <label class="field">
          <span class="sr">GitHub username</span>
          <span class="at" aria-hidden="true">
            @
          </span>
          <input
            value={user}
            onInput={(e) => (setUser(e.currentTarget.value), setProblem(null))}
            placeholder="username"
            autocomplete="username"
            autocapitalize="off"
            autocorrect="off"
            spellcheck={false}
            enterkeyhint="go"
            maxLength={40}
            aria-invalid={problem ? 'true' : 'false'}
            aria-describedby="entry-problem"
          />
        </label>
        <label class="year">
          <span class="sr">Year</span>
          <select value={year} onChange={(e) => setYear(Number(e.currentTarget.value))}>
            {years.map((y) => (
              <option value={y}>{y}</option>
            ))}
          </select>
        </label>
        <button type="submit" class="cta">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 4.5v15l13-7.5z" fill="currentColor" />
          </svg>
          Play my year
        </button>
      </form>
      <p id="entry-problem" class="problem" role="alert">
        {problem}
      </p>

      <p class="fine">
        Reads public contributions only. Nothing is stored. Not affiliated with GitHub. <a href="/about">About &amp; privacy</a>
      </p>
    </main>
  );
}
