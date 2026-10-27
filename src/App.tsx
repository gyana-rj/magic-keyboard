import { useState } from 'preact/hooks';
import type { ContributionData } from '../shared/types';
import { loadContributions } from './api';

// Phase 0 placeholder: fetches data and shows the raw graph. Audio/visuals come in later phases.
export function App() {
  const [user, setUser] = useState('active');
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<ContributionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setData(await loadContributions(user.trim(), year));
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Commit Symphony</h1>
      <p>Your contribution year, as a 30-second song. Free and open source, for GitHub users.</p>
      <form onSubmit={submit}>
        <input value={user} onInput={(e) => setUser(e.currentTarget.value)} aria-label="GitHub username" />
        <input
          type="number"
          value={year}
          onInput={(e) => setYear(Number(e.currentTarget.value))}
          aria-label="Year"
        />
        <button disabled={busy}>{busy ? 'Loading…' : 'Compose'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {data && (
        <section>
          <p>
            {data.user} · {data.year} · {data.total} contributions
            {data.total === 0 && ' (a quiet year)'}
          </p>
          <div class="grid" aria-hidden="true">
            {data.weeks.map((week) => (
              <div class="col">
                {week.map((level) => (
                  <span class={`cell l${level}`} />
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
