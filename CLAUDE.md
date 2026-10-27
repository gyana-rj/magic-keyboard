# Commit Symphony

Free, MIT-licensed web app: a GitHub user's yearly contribution graph becomes a ~30 s song with a
synced visual, a shareable card and a link. Stack: Vite + TypeScript + Preact, Tone.js, one Vercel function.
Read `docs/PLAN.md` for architecture and the music mapping. Track work in `docs/PROGRESS.md`.

## Commands
- `npm run dev`: Vite dev server; serves `/api/contributions` itself (fixtures unless `GITHUB_TOKEN` is set)
- `npm run build`: typecheck (`tsc --noEmit`) + production build to `dist/`
- `npm test`: Vitest, once (`tests/`)
- `/dev-music.html` (while dev runs): temporary page to tune the sound with fixtures. Remove after tuning.
- In dev, type a fixture name as the username: `active`, `weekend`, `burst`, `empty`.
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
- Audio must start from a user tap: `unlockAudio()` runs inside the "Play my year" click; never start playback from a timer/effect
  unless it was unlocked by that tap. Respect `prefers-reduced-motion` in any new animation (canvas and CSS).
- Share link is `/u/<login>/<year>` (`src/url.ts`, rewritten to `api/share` in `vercel.json`); always validate params with the
  server validators and escape everything injected into HTML (`server/meta.ts`). OG image = SVG built in `server/og.ts`,
  rasterized by resvg-js with the embedded font (don't use `@vercel/og`: its Node build doesn't load outside Next).
  Cards reuse `drawFrame` and `buildCardModel`; keep card text free of forbidden branding (tested).
- Keep the bundle small: Tone.js, the player, the share panel and `src/video/` are lazy chunks. Landing may only import
  `music/audio.ts` (unlock helpers), never `music/player.ts`. Video MP4 only with explicit H.264+AAC codecs (see `video/formats.ts`).
- API abuse protection lives in `server/` (limiter, cache, strict params); new endpoints must use `runtime.limiter` and `runtime.source`.
- Branding: say "for GitHub users". Never use GitHub's logo or the words "GitHub Wrapped".
- Music: `src/music/mapping.ts` stays pure (no Tone import); all pitches go through `noteAt`; seed randomness from user+year.
  Tone.js code lives only in `instruments.ts`/`player.ts`.
- Check current docs (Tone.js, Vercel Functions) before using an API from memory.
- Before finishing: `npm run build && npm test` must pass. Update `docs/PROGRESS.md`.

## Gotchas
- Cloud sandboxes may export their own `GITHUB_TOKEN`; run `env -u GITHUB_TOKEN npm run dev` to get fixtures.
- GitHub returns 53 calendar columns per year; `normalizeUser` folds them to 52.
- Zero contributions is valid data (200, `total: 0`), not an error.
- Don't `pkill -f` a pattern that also appears in your own command line (it kills your shell); `scripts/gen-icons.mjs` needs Playwright.
