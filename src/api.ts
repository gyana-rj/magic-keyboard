import type { ApiError, ContributionData } from '../shared/types';

export async function loadContributions(user: string, year: number): Promise<ContributionData> {
  const res = await fetch(`/api/contributions?user=${encodeURIComponent(user)}&year=${year}`);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((body as ApiError | null)?.error.message ?? 'Something went wrong. Please try again.');
  }
  return body as ContributionData;
}
