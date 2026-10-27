import type { ContributionsError } from '../api';
import { errorCopy } from '../copy';

interface Props {
  error: ContributionsError;
  user: string;
  onRetry: () => void;
  onBack: () => void;
}

export function ErrorView({ error, user, onRetry, onBack }: Props) {
  const c = errorCopy(error.code, user);
  return (
    <main class="center">
      <div class="bars flat" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6].map(() => (
          <i />
        ))}
      </div>
      <div role="alert">
        <h2>{c.title}</h2>
        <p class="status">{c.body}</p>
      </div>
      <div class="row">
        {c.retry && (
          <button class="cta small" onClick={onRetry}>
            Try again
          </button>
        )}
        <button class={c.retry ? 'ghost' : 'cta small'} onClick={onBack}>
          Try another name
        </button>
      </div>
    </main>
  );
}
