# Commit Symphony: Plan

A free, MIT-licensed web app that turns a GitHub user's yearly contribution graph into a ~30-second
song with a synced visual, plus a shareable card and link. Branding rule: say "for GitHub users";
never use GitHub's logo or the words "GitHub Wrapped".

## Architecture

```
Browser (Vite + Preact + TS)                Vercel (free tier)
┌──────────────────────────────┐   GET    ┌───────────────────────────┐   GraphQL   ┌────────┐
│ UI · music engine (Tone.js)  │ ───────▶ │ api/contributions.ts      │ ──────────▶ │ GitHub │
│ visual (canvas) · share card │ ◀─────── │ validate → fetch → shape  │ ◀────────── │  API   │
└──────────────────────────────┘  JSON    └───────────────────────────┘  GITHUB_TOKEN └────────┘
                                           CDN caches responses ~6h
```

- **Static client** built by Vite; **one serverless function** (`api/contributions.ts`, web-standard
  `GET(request): Response` handler, Node runtime).
- **No database, no accounts.** A share link is just `/?u=<user>&y=<year>`; the client re-fetches (CDN-cached)
  and re-composes. Music is deterministic from the data, so the link reproduces the same song.
- **Token stays server-side.** `GITHUB_TOKEN` is read only in the function. The client never sees it.
- **Code layout:** `api/` thin Vercel entry · `server/` testable logic (validation, GitHub query,
  normalization, handler, dev wiring) · `shared/` types used by both sides · `src/` client ·
  `fixtures/` sample datasets · `tests/`.
- **Bundle budget:** Preact (~4 kB) + app code. Tone.js is large, so it is loaded with a dynamic `import()` only when
  the user presses Play (it needs a user gesture to start audio anyway).

## Data flow

1. Client calls `GET /api/contributions?user=<login>&year=<yyyy>`.
2. Function validates the login (GitHub's rules, ≤39 chars) and year (2008..current) before any network call.
3. One GraphQL query (`contributionsCollection` with `from`/`to` for the year) returns the calendar plus commit
   counts per repository for language ranking.
4. `normalizeUser` folds GitHub's 53 calendar-aligned columns into **52 weeks × 7 weekdays** (the trailing
   partial column merges into the leading one, busier level wins) and maps levels `NONE..FOURTH_QUARTILE` → `0..4`.
5. Response: `{ user, year, weeks: Level[52][7], total, topLanguages: string[] }`.
6. Caching: success `s-maxage=21600` (6h) with stale-while-revalidate; not-found and zero-contribution
   years 5 min; rate-limit and server errors `no-store`.

### Errors (friendly messages, `{ error: { code, message } }`)

| code | status | when |
| --- | --- | --- |
| `invalid_user` / `invalid_year` | 400 | failed validation |
| `not_found` | 404 | no such user |
| `rate_limited` | 429 (+`Retry-After`) | GitHub 403/429 or GraphQL `RATE_LIMITED` |
| `upstream_error` | 502 | network failure, 5xx, unparseable reply |
| `server_misconfigured` | 500 | missing/rejected token (details never exposed) |

A **zero-contribution year is not an error**: it returns 200 with `total: 0` and the app plays a short
"quiet year" piece. Only public contributions are visible unless the user enables private ones in their profile.

## Music mapping

The mapping is a pure function `data → note events`, deterministic (any "randomness" is seeded from user+year).

- **Time:** 52 weeks = 52 beats. At 104 BPM that is 13 bars of 4/4 = exactly 30.0 s. One beat per week.
- **Pitch:** 7 weekdays = 7 degrees of a scale (Sun→degree 1 … Sat→degree 7). Inside a beat, active days
  sound as a quick strum from Sunday to Saturday; inactive days are silent, so an empty week is a rest.
- **Level 0-4 → velocity and layering:**
  - 0: silent
  - 1: soft note (velocity ≈ 0.25)
  - 2: medium (≈ 0.45)
  - 3: strong (≈ 0.7) + octave doubling
  - 4: loud (≈ 0.95) + octave doubling + bass note and percussion accent on the beat
- **Scale/mood from the whole year** (ideas to tune by ear): busy and steady → major; weekend-heavy or sparse →
  minor pentatonic (never sounds "wrong"); top language can pick the timbre (synth/pluck/bell).
- **Shape:** a light pad and kick under every non-empty week keep a long quiet stretch from sounding broken; a
  final held chord is the 30 s mark.
- **Offline render:** Tone.Offline renders the same events to a buffer for a downloadable audio clip (stretch).

## Visual and share

- Canvas heatmap of the 52×7 grid; a playhead sweeps one column per beat and cells pulse as their notes fire.
  Driven by the same event list as the audio (scheduled on `Tone.Transport`, drawn from `Tone.getDraw()`).
- **Share card:** client-side canvas → PNG (grid, total, top languages, year, "for GitHub users" line).
- **Share link:** `/?u=&y=`; optional later: `api/og` for an Open Graph preview image.

## Phases

0. **Foundation** (this session): docs, scaffold, `api/contributions`, fixtures, tests, CI-ready build.
1. **Music engine:** mapping function + unit tests, Tone.js playback (lazy loaded), play/stop, tune by ear on fixtures.
2. **Visual:** synced canvas playhead and note pulses; responsive layout; reduced-motion handling.
3. **Share:** PNG card, share link and URL state, copy/download buttons.
4. **Polish and launch:** error and empty states, a11y, Open Graph image, README with GIF, Vercel deploy,
   token setup docs, attribution/branding check.

## Risks

- **Rate limits:** the GitHub token allows 5,000 points/hour. The 6h CDN cache is the main defence; the error path
  is friendly. Watch usage after launch.
- **Autoplay policy:** audio must start from a click; Play is the only entry point.
- **Private contributions:** invisible by default; explain in the UI and README.
- **Dependency drift:** Tone.js, Vite and Preact majors move; versions are pinned in the lockfile.
