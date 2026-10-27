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

Implemented in `src/music/`: `mapping.ts` (`composeSong(data) → Song`, plain JSON, no audio), `genres.ts`,
`scales.ts`, `prng.ts`, and the Tone.js side in `instruments.ts` + `player.ts`. Deterministic: the seed is
`hash(lowercase(user) + ":" + year)`; each week gets its own sub-stream, so editing one week never shifts another.

- **Time:** 52 weeks = 52 beats, one beat per week, plus a 2-beat intro and 2-beat outro (56 beats). Tempo 104-120 BPM
  by genre, so the 52 weeks last 26-30 s and the whole song about 29-33 s including the ringing final chord.
- **Quantized to a scale:** every pitch comes from `noteAt(root, mode, degree, octave)`, so nothing can be out of key.
  Root (12 keys) and mode are picked from the seed within the genre's allowed modes (ionian, dorian, lydian,
  mixolydian, aeolian). A chord progression (root degree per bar, 13 bars) is picked from the seed.
- **Pitch:** 7 weekdays = 7 degrees of the scale (Sun = degree 1 … Sat = 7). A week's active days are strummed across its
  beat, ascending or descending (seeded per week), in octave 4 or sometimes 5.
- **Level 0-4 → velocity and layering:** 1 = 0.25, 2 = 0.45, 3 = 0.7 + octave-down doubling, 4 = 0.95 + doubling.
- **Weekly tier (0-3)** is the week's level sum relative to the year's 90th percentile. It drives the rhythm section:
  - tier 0 (empty week): no drums or bass; the pad carries on and an occasional soft "sparkle" bell plays
  - tier 1: kick, bass on the beat · tier 2: + hats and the full bass pattern · tier 3: + snare, fill on the bar's last beat
- **Pads never stop:** one triad per bar for the whole song, fuller when the bar is empty, softer when busy. A year
  with zero contributions is a pure ambient piece.
- **Genre** comes from the most-used language that has a preset (first match in `topLanguages`), else the fallback (lo-fi):
  lo-fi (Python, Ruby, PHP…), synthwave (TypeScript, JavaScript, Swift…), chiptune (C, C++, Rust, Zig…),
  house (Go, Java, Kotlin, C#…), ambient (Haskell, Elixir, OCaml…; also any year with 0 contributions).
  A preset sets tempo range, allowed modes, drum and bass patterns (one 8-step bar each) and the synth voicing.
- **Bounded polyphony:** at most `MAX_POLYPHONY` (14) events sound at once; asserted in tests, including random and maxed-out data.
- **Player:** Tone.js is imported on first Play. Events are scheduled on `Tone.getTransport()` in ticks; a per-beat
  callback goes through `Tone.getDraw()` so visuals line up with what you hear. `renderSong` renders offline for
  tests and a future audio download. The mix has 3 dB headroom plus a limiter.

## Experience and visual

**Flow** (`src/App.tsx`): Landing → Loading → Player, or → Error. "Play my year" is the user gesture: inside that tap the app
calls `unlockAudio()` (resumes the audio context synchronously when Tone is already preloaded, which iOS Safari
needs) and starts the fetch. When data arrives it autoplays only if the context really is running; otherwise the
player view waits for an explicit Play tap. Stop/Play/Play again are always taps. Tone.js is preloaded on the first
touch or keypress (not on page load), so the browser doesn't warn about an early audio context.

**Views** (`src/views/`): Landing (username, year select, pitch), Loading (rotating lines, cancel), ErrorView
(copy per error code in `src/copy.ts`: not found, bad name, rate limited, network, upstream), PlayerView (graph, play
button, stats). A zero-contribution year plays the ambient piece with a "silent year" note. Stats live in
`src/stats.ts`: total, busiest week (by level sum, as a date range), longest streak (approximate within a day or two of
New Year's because week 0 also holds the folded-in last days of December), genre with key and BPM.

**Visual** (`src/visual/`, one canvas):
- **Same events as the audio.** Each lead note carries its graph cell (`cell: [week, day]`); `buildPulses` yields one
  pulse per active cell and `cellBeats` the beat each cell lights at.
- **Sync:** the player's per-beat callback (via `Tone.getDraw()`) re-anchors a `BeatClock`; `requestAnimationFrame` reads
  a smooth fractional beat from it, so drift can't accumulate.
- **Look:** cells light one by one as their notes sound (the strum order within a week is visible); a glowing column
  sweep with a trailing wash; the cell that just fired swells and glows; loud notes (levels 3-4) throw capped, seeded
  sparks. Colors come from a per-genre palette (`palettes.ts`), which also themes the page.
- **Responsive:** `computeLayout(width)`: one 52-column band, or on phones (< 640 px) two stacked 26-week bands so cells
  stay readable. DPR-aware; redraws on resize; the loop runs only while playing.
- **Reduced motion:** columns light a week at a time, stepped column highlight, no glow, pulses or sparks (also no CSS animation).
**Share** (`src/share/`, `src/url.ts`, `src/views/SharePanel.tsx`, `server/share.ts`, `server/og.ts`):
- **Link:** `/u/<login>/<yyyy>` (the older `/?u=&y=` still works). `parseSharePath` validates with the API's rules.
  A tap on "Play my year" pushes the path; opening a link replaces it. The app is stateless: the link re-fetches
  (CDN-cached) and recomposes the same deterministic song.
- **Link visitors can't autoplay** (no gesture): they land on the player and tap Play. The audio engine is warmed on their
  first touch; if the browser still refuses audio, the caption asks for another tap rather than running silently.
- **Link previews, server-side.** `vercel.json` rewrites `/u/:user/:year` to `api/share`, which fetches the (cached)
  result and returns the app's own `index.html` with the title, description, canonical URL and Open Graph + Twitter card
  tags filled in (`server/meta.ts`, every value escaped), so crawlers that never run JavaScript see the real result.
  It reads `dist/index.html` (bundled with `includeFiles`), else fetches it from the deployment, else serves a tiny
  redirect page that still carries the tags. Unknown user → 404 with generic tags (the app explains); a GitHub outage
  or rate limit → 200, `no-store`, generic tags. `PUBLIC_URL` pins the origin used in absolute URLs.
- **OG image:** `api/og?user=&year=` → 1200×630 PNG showing the graph, name, year, genre and total. Findings from the
  current Vercel docs: `@vercel/og` (Satori + Resvg) is the documented route, but its Node build needs a `hb.wasm`
  file the package doesn't ship and fails to load outside Next's bundler, and the "other frameworks" example is
  Edge-only with Vercel-specific wasm imports. So `server/og.ts` builds the SVG itself (a pure function, tested) and
  rasterizes it with `@resvg/resvg-js` (the same renderer) using an embedded Inter subset (SIL OFL, 43 KB,
  `server/fontData.ts`), so output is identical everywhere and no file tracing is needed. Any failure returns the
  generic card, never a broken image. `robots.txt` allows `/api/og`.
- **Cards:** client-side canvas PNGs in three formats: landscape 1200×630, square 1080×1080, story 1080×1920 (phone
  layout: the year wraps into two bands; stats stack on the story card). Positions live in data (`cardLayout`) so
  they are tested for bounds and overlap. Text comes from `buildCardModel`, shared with the stats under the player.
- **WAV:** `renderSong` renders the song description offline (`Tone.Offline`, not a recording of the speakers);
  `encodeWav` writes 16-bit PCM. About 5 MB, 44.1 kHz stereo, ~16 s to render on a slow machine.
- **Buttons:** Copy link, Post on X, LinkedIn, WhatsApp (plain web-intent links, no SDKs or trackers), and the OS share
  sheet where `navigator.share` exists (attaches the image where allowed).

## Phases

0. **Foundation** (this session): docs, scaffold, `api/contributions`, fixtures, tests, CI-ready build.
1. **Music engine:** mapping function + unit tests, Tone.js playback (lazy loaded), play/stop. Mapping and player are built; tuning by ear is ongoing via `/dev-music.html`.
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
