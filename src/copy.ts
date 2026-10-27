import type { ClientErrorCode } from './api';

export interface ErrorCopy {
  title: string;
  body: string;
  /** Whether trying the same request again could help. */
  retry: boolean;
}

export function errorCopy(code: ClientErrorCode, user: string): ErrorCopy {
  switch (code) {
    case 'not_found':
      return {
        title: 'Nobody by that name in the orchestra',
        body: `We couldn't find a GitHub user called "${user}". Check the spelling and give it another go.`,
        retry: false,
      };
    case 'invalid_user':
      return {
        title: "That doesn't look like a username",
        body: 'GitHub usernames use letters, numbers and single hyphens, up to 39 characters.',
        retry: false,
      };
    case 'invalid_year':
      return { title: 'That year has no stage', body: 'Pick a year from 2008 up to this one.', retry: false };
    case 'rate_limited':
      return {
        title: 'The hall is packed tonight',
        body: "We've asked GitHub for a lot of songs and it wants us to slow down. Try again in a few minutes.",
        retry: true,
      };
    case 'network':
      return {
        title: 'The cable came unplugged',
        body: "We couldn't reach the server. Check your connection and try again.",
        retry: true,
      };
    default:
      return {
        title: 'The stage lights flickered',
        body: 'Something went wrong on our side or at GitHub. Give it a moment and try again.',
        retry: true,
      };
  }
}

export const LOADING_LINES = [
  'Tuning the strings…',
  'Counting your commits…',
  'Finding the key your year is in…',
  'Teaching the drummer your weekends…',
  'Almost on stage…',
];
