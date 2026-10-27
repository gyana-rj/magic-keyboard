import { useEffect, useState } from 'preact/hooks';
import { LOADING_LINES } from '../copy';

export function Loading({ user, onCancel }: { user: string; onCancel: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, LOADING_LINES.length - 1)), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <main class="center" aria-busy="true">
      <div class="bars" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
          <i style={{ animationDelay: `${n * 0.12}s` }} />
        ))}
      </div>
      <h2>@{user}</h2>
      <p class="status" role="status">
        {LOADING_LINES[i]}
      </p>
      <button class="ghost" onClick={onCancel}>
        Cancel
      </button>
    </main>
  );
}
