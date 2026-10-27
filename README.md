# Commit Symphony

Turn your yearly contribution graph into a **30-second song**, with a synced visual, a shareable card and a link.
Free, open source (MIT), made for GitHub users. Not affiliated with or endorsed by GitHub.

<!-- Screenshots: see docs/screenshots/README.md for what to capture -->

| Landing | Player | Share |
| --- | --- | --- |
| _`docs/screenshots/landing.png`_ | _`docs/screenshots/player.png`_ | _`docs/screenshots/card-square.png`_ |

_(Screenshots are placeholders for now.)_

## What it does

- Type a username and a year; it plays that year as music while the contribution graph lights up cell by cell.
- Share it: a link (`/u/<name>/<year>`) with a proper preview image, PNG cards (landscape, square, story), the song as a WAV,
  and a vertical video for Reels, Shorts and X.
- Works on phones. Respects `prefers-reduced-motion`. No accounts, no cookies, no analytics.

## How it works

```
Browser (Vite + Preact + TypeScript)             Vercel (free tier)
┌────────────────────────────────┐   GET    ┌──────────────────────────────┐  GraphQL  ┌────────┐
│ landing · player · share panel │ ───────▶ │ api/contributions            │ ────────▶ │ GitHub │
│ music (Tone.js) · canvas visual│ ◀─────── │ validate → cache → shape     │ ◀──────── │  API   │
└────────────────────────────────┘   JSON   │ api/share  /u/:user/:year    │  (token)  └────────┘
                                            │ api/og     link-preview PNG  │
                                            └──────────────────────────────┘
```

1. **Data.** `GET /api/contributions?user=&year=` validates the input, asks GitHub's GraphQL API for that year's
   `contributionsCollection` using a server-side token, and returns a minimal normalized JSON:
   `{ user, year, weeks: Level[52][7], total, topLanguages }` where every level is 0-4 (GitHub's own quartiles).
   GitHub returns 53 calendar columns a year; the last is folded into the first to get exactly 52.
2. **Song.** `composeSong(data)` (pure, no audio) turns that into a plain-JSON song description: a list of note events.
3. **Sound.** Tone.js (loaded only when you press Play) plays the events. The same events drive the visual, so what you see
   is what you hear.
4. **Share.** `/u/<name>/<year>` is served by a function that fills in Open Graph and Twitter card tags (and the
   `/api/og` image) so links unfurl properly, then the app boots and loads that result. Cards, WAV and video are all
   made in your browser.

There is no database and no state. Everything is derived from the (cached) contribution data, deterministically.

## How the music mapping works

The whole mapping is one pure function in [`src/music/mapping.ts`](src/music/mapping.ts), unit-tested for determinism,
scale correctness and bounded polyphony.

| Contribution graph | Becomes |
| --- | --- |
| 52 weeks | 52 beats, one week per beat (plus a 2-beat intro and a 2-beat outro) |
| 7 weekdays | the 7 degrees of a scale (Sunday = degree 1 … Saturday = 7), strummed across the beat |
| level 0-4 of a day | velocity 0 / 0.25 / 0.45 / 0.7 / 0.95; levels 3-4 also double the note an octave down |
| a week's total activity | its **tier** (0-3, relative to that person's own busy weeks), which sets the rhythm section |
| most-used language | the **genre** preset (lo-fi, synthwave, chiptune, house, ambient; lo-fi if unknown) |
| username + year | the seed for key, mode, tempo, chord progression and small variations |

Rules that make every result sound good, even for random-looking data:

- **Always in key.** Every pitch comes from one function, `noteAt(root, mode, degree, octave)`, so nothing can be out of
  the scale. The key (12 options) and mode (ionian, dorian, lydian, mixolydian, aeolian) are picked from the seed, within
  what the genre allows. A 4-chord progression (as scale degrees) is picked per song and cycled over 13 bars.
- **Never silent.** A soft pad plays a chord every bar, fuller when the bar is empty and quieter when it is busy. Empty
  weeks also get an occasional quiet bell. A year with no contributions becomes a gentle ambient piece.
- **Rhythm follows effort.** Empty week: no drums or bass. Tier 1: kick and bass on the beat. Tier 2: add hats and the
  full bass pattern. Tier 3: add the snare and a fill at the end of each bar.
- **Tempo 104-120 BPM** by genre, so the 52 weeks last 26-30 seconds and the whole song about 29-33.
- **Deterministic.** The same user and year always give the same song (randomness is seeded per week, so changing one
  week never shifts another). Usernames are case-insensitive.
- **Bounded.** At most 14 notes ever sound at once.

The visual reads the same event list: each lead note knows its graph cell (`cell: [week, day]`), so the grid lights
up in the order you hear it, and louder notes throw sparks. Details are in [`docs/PLAN.md`](docs/PLAN.md).

## Self-hosting (Vercel free tier)

1. **Fork or clone** this repository.
2. **Create a GitHub token** that can read public data: a fine-grained personal access token with no extra
   permissions, or a classic token with no scopes. Never put it in the client or commit it.
3. **Import the repo in Vercel.** The Vite preset is detected (build `npm run build`, output `dist`). Add environment variables:

   | Variable | Required | Purpose |
   | --- | --- | --- |
   | `GITHUB_TOKEN` | yes | Server-side only. Read by the functions in `api/`; never sent to the browser. |
   | `PUBLIC_URL` | recommended | Your canonical origin (for example `https://symphony.example.com`), used in share links and preview tags. Defaults to the request's origin. |

4. **Deploy.** Then check `/u/octocat/2025` (view source: the `og:` tags are there) and `/api/og?user=octocat&year=2025`
   (a PNG). Paste a result link into a card validator such as the one in X's or LinkedIn's post composer.
5. **Add a rate-limit rule** (recommended, takes a minute). Vercel's firewall can stop abusive clients before they reach a
   function. With the Vercel CLI:

   ```sh
   vercel firewall rules add "Rate limit API" \
     --condition '{"type":"path","op":"pre","value":"/api"}' \
     --action rate_limit --rate-limit-window 60 --rate-limit-requests 100 \
     --rate-limit-keys ip --rate-limit-action deny --yes
   ```

   Then publish the change from the dashboard (Firewall → Review Changes → Publish).

Without a token the functions return a friendly "server not set up" error. GitHub's GraphQL API allows 5,000 points an
hour per token; the 6-hour caching below is what keeps you far from that.

### Abuse protection

Layers, outermost first:

1. **Vercel firewall** rate limit per IP (step 5 above), if you add it.
2. **CDN cache.** Successful results are cached for 6 hours (`s-maxage=21600`, plus stale-while-revalidate); not-found and
   empty years for 5 minutes; errors never.
3. **In-function limiter and cache.** Each function instance allows 30 requests a minute per client and keeps an LRU cache
   keyed by lower-cased user and year, with simultaneous identical requests de-duplicated. Changing letter case or a query
   string cannot force new GitHub calls. (On serverless this is per warm instance, so treat it as the second line.)
4. **Strict validation.** Usernames must match GitHub's rules (1-39 characters, letters, digits, single hyphens), the year
   must be 2008 to now, and `/api/contributions` rejects any other query parameter, so it can't be used to bust the cache.

## Privacy

- Only **public** contribution data is read, through GitHub's API, for the name that was typed. Contributions to private
  repositories do not appear unless the user has chosen to show them on their profile.
- There are **no accounts, cookies, analytics or ads**, and nothing about anyone is stored in a database.
- The only things kept are short-lived caches of the public result (CDN and function memory, a few hours) and a
  per-minute request counter in memory. IP addresses are used for the counter only and are not logged or stored by this app.
- Cards, songs and videos are generated in the browser and never uploaded.

Hosting providers keep their own logs; see your host's policy if you self-host.

## Development

```sh
npm install
npm run dev        # Vite dev server; serves the API itself with fixtures (no token needed)
npm test           # Vitest
npm run build      # typecheck + production build
```

In dev, type a fixture name as the username: `active`, `weekend`, `burst` or `empty` (four realistic sample years). To use
real data, copy `.env.example` to `.env` and set `GITHUB_TOKEN`. Tests never call GitHub.

`/dev-music.html` (dev only) is a small page for listening to the fixtures while tuning the sound.

Other scripts: `npm run fixtures` regenerates the sample data; `node scripts/gen-icons.mjs` regenerates the icons (needs
Playwright).

### Project layout

| Path | What |
| --- | --- |
| `api/` | Vercel functions: `contributions`, `share` (`/u/:user/:year`), `og` (preview image). Thin wrappers. |
| `server/` | Testable server logic: validation, GitHub query and normalization, cache, rate limiter, meta tags, OG image |
| `shared/` | The API contract (`types.ts`) |
| `src/music/` | Song mapping, genres, scales, Tone.js instruments and player, WAV encoder |
| `src/visual/` | Layout, beat clock, pulses, particles, the animated grid scene and its canvas drawing |
| `src/share/`, `src/video/` | Share cards, links, WAV/video export |
| `src/views/` | Landing, loading, errors, player, share panel |
| `fixtures/` | Sample datasets used in dev and tests |
| `docs/` | Plan, progress log, screenshot placeholders |

## Known limits

- Longest-streak is approximate within a day or two of New Year's (the folded 53rd column).
- Video export records in real time and needs the tab visible. MP4 (H.264 + AAC) is only offered where the browser can
  really record it (Safari, and Chrome with an OS H.264 encoder); everywhere else you get WebM, with a note about converting
  it for Instagram and X. Browsers without `MediaRecorder` see a message and can still use the image and WAV downloads.
- Autoplay is blocked by browsers, so a shared link always opens with a Play button.

## Credits and license

MIT, see [LICENSE](LICENSE). Built with [Preact](https://preactjs.com/), [Tone.js](https://tonejs.github.io/),
[resvg](https://github.com/RazrFalcon/resvg) and [fix-webm-duration](https://github.com/yusitnikov/fix-webm-duration). Link-preview
images use a Latin subset of the [Inter](https://github.com/rsms/inter) typeface (SIL Open Font License 1.1, see
`server/fonts/LICENSE-Inter.txt`). GitHub is a trademark of its owner; this project is independent.
