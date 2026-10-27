# Commit Symphony

Free, MIT-licensed web app: a GitHub user's yearly contribution graph becomes a ~30 s song with a
synced visual, a shareable card and a link. Stack: Vite + TypeScript + Preact, Tone.js, one Vercel function.
Read `docs/PLAN.md` for architecture and the music mapping. Track work in `docs/PROGRESS.md`.

## Commands
- `npm run dev`: Vite dev server; serves `/api/contributions` itself (fixtures unless `GITHUB_TOKEN` is set)
- `npm run build`: typecheck (`tsc --noEmit`) + production build to `dist/`
- `npm test`: Vitest, once (`tests/`)
- `/dev-music.html` (while dev runs): temporary page to listen to fixtures. Remove with the real UI.
- `npm run fixtures`: regenerate `fixtures/*.json` (deterministic; commit the output)

## Rules
- NEVER expose the GitHub token to the client. `GITHUB_TOKEN` is read only in `api/` and `server/`.
  Never prefix it `VITE_`, never log it, never put it in a response, fixture or test.
- Develop against fixtures, not the live API. Use `?user=active|weekend|burst|empty` in dev. Tests must
  mock `fetch`; no test may call GitHub. Do not run dev with a real token unless asked.
- The API contract is `shared/types.ts` (`weeks[52][7]` levels 0-4). Change it in one place, update PLAN.md.
- Keep logic in `server/` and `src/` pure and unit-tested; `api/contributions.ts` stays a thin wrapper.
- Relative imports under `api/` and `server/` use `.js` extensions (Vercel runs them as ESM).
- Visual (`src/visual/`): pure modules (layout, clock, pulses) are unit-tested; `draw.ts`/`Visual.tsx` need a browser.
  Pulses come from `song.events[].cell`, never from a separate timer.
- Keep the bundle small. Load Tone.js with dynamic `import()` on Play, not at startup.
- Branding: say "for GitHub users". Never use GitHub's logo or the words "GitHub Wrapped".
- Music: `src/music/mapping.ts` stays pure (no Tone import); all pitches go through `noteAt`; seed randomness from user+year.
  Tone.js code lives only in `instruments.ts`/`player.ts`.
- Check current docs (Tone.js, Vercel Functions) before using an API from memory.
- Before finishing: `npm run build && npm test` must pass. Update `docs/PROGRESS.md`.

## Gotchas
- Cloud sandboxes may export their own `GITHUB_TOKEN`; run `env -u GITHUB_TOKEN npm run dev` to get fixtures.
- GitHub returns 53 calendar columns per year; `normalizeUser` folds them to 52.
- Zero contributions is valid data (200, `total: 0`), not an error.
