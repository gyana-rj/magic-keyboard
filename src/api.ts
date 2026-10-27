import type { ApiError, ApiErrorCode, ContributionData } from '../shared/types';

export type ClientErrorCode = ApiErrorCode | 'network';

export class ContributionsError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export async function loadContributions(user: string, year: number, signal?: AbortSignal): Promise<ContributionData> {
  let res: Response;
  try {
    res = await fetch(`/api/contributions?user=${encodeURIComponent(user)}&year=${year}`, { signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ContributionsError('network', 'Could not reach the server.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (body as ApiError | null)?.error;
    throw new ContributionsError(e?.code ?? 'upstream_error', e?.message ?? 'Something went wrong.');
  }
  return body as ContributionData;
}
