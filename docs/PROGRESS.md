# Progress

## Phase 0: Foundation
- [x] `docs/PLAN.md`
- [x] `CLAUDE.md`
- [x] `docs/PROGRESS.md`
- [x] Vite + TypeScript + Preact scaffold; `npm run build` and `npm test` pass
- [x] `api/contributions.ts`: validation, GraphQL fetch, normalization, friendly errors, 6h cache headers
- [x] 4 fixtures (active, weekend, burst, empty) + generator script
- [x] Dev mode serves fixtures when no `GITHUB_TOKEN`
- [x] Unit tests: validation, normalization, GitHub error mapping, handler, fixtures
- [ ] Deploy to Vercel and set `GITHUB_TOKEN` (manual)

## Phase 1: Music engine
- [x] Pure mapping `data → song` (`src/music/mapping.ts`), seeded from user+year
- [x] Scale quantization, key/mode from seed, bass line, drums that follow weekly tiers, ambient pads, intro/outro
- [x] 5 genre presets + fallback, picked from top language
- [x] `player.ts`: Tone.js playback (lazy-loaded), per-beat playhead events, offline `renderSong`
- [x] Tests: determinism, scale correctness, all fixtures valid, polyphony bound, 300 random datasets
- [x] Temporary listening page: `npm run dev` then open `/dev-music.html`
- [x] Automated audio check in headless Chromium: no clipping, no silent seconds, no console warnings, playhead fires every beat
- [ ] **Tune by ear** (needs a human): mix levels, synth choices, tempo/pad feel per genre
- [ ] Remove `dev-music.html` + `src/dev/` once the real UI plays songs

## Phase 2: Visual
- [x] Lead notes carry their `cell`; pulses derived from the song (one per active cell, tested)
- [x] Canvas heatmap synced to the player's beat events (`BeatClock` + rAF), cells light one by one
- [x] Glowing column sweep, note pulses scaled by level, sparks on loud notes, per-genre palettes
- [x] Responsive: single band on desktop, two stacked bands on phones; DPR-aware
- [x] `prefers-reduced-motion`: week-by-week lighting, stepped highlight, no pulses or sparks
- [ ] Judge the look and the audio/visual sync by eye and ear (needs a human)

## Phase 2b: Main experience
- [x] Landing: big username input, year picker (default current year), pitch, "Play my year"; works on mobile (no horizontal scroll at 375 px)
- [x] Input validation with inline messages; Loading view with rotating lines and Cancel
- [x] Error views with personality for not found, invalid name, rate limit, network, upstream; Try again / Try another name
- [x] Silent year: zero contributions plays the ambient track with a gentle note
- [x] Player view: canvas graph, Play/Stop/Play again, live "Week N · dates" caption, stats (total, busiest week, longest streak, genre + key/BPM)
- [x] Audio is only ever started from a tap: unlocked inside the "Play my year" tap, autoplay only if the browser allowed it, otherwise an explicit Play
- [x] Original visual design (own wordmark, palette, layout); no GitHub logos or styling
- [x] Browser-tested (headless Chromium, real autoplay policy): happy path, all error states, silent year, reduced motion, 375 px and desktop
- [ ] Test on a real iPhone/Safari (the audio-unlock path is the riskiest part; headless Chromium can't prove it)
- [ ] Remove `dev-music.html` + `src/dev/` once sound tuning is done (kept for now so the sound can be tuned)

## Phase 3: Share
- [x] PNG share card (1200×630): heatmap, stats, genre, key/BPM; long names shrink to fit
- [x] Share link `/?u=&y=`: validated parsing, history (Back/Forward), shared links load straight into the player
- [x] Link visitors tap Play (no autoplay); audio warmed on first touch; refused audio shows a retry caption
- [x] Copy link, Download image, native Share sheet (where supported); feedback via live region
- [x] Tests: link parsing and round trip, card text for fixtures and a silent year, layout bounds, no forbidden branding
- [x] Browser-tested: link load, first-tap play, clipboard, download (PNG inspected), Back/Forward, bad link, missing user via link, 375 px
- [ ] Try the native share sheet on a real phone (not available in headless Chromium)
- [ ] Open Graph image so pasted links show a preview (Phase 4, `api/og`)

## Phase 3b: Shareable results
- [x] `/u/{username}/{year}` loads that result; Play is one tap (browsers block autoplay); legacy `/?u=&y=` still works
- [x] Link previews: `api/share` renders Open Graph + Twitter card tags server-side into the real app shell (tested)
- [x] Dynamic OG image `api/og` (graph, name, genre, total); generic card on any failure (tested, real PNG render in tests)
- [x] Share cards as PNG: landscape 1200×630, square 1080×1080, story 1080×1920
- [x] Song as WAV, rendered offline from the song description (checked with ffprobe: 30.5 s, 16-bit stereo, peak -4 dB)
- [x] Buttons: Copy link, X, LinkedIn, WhatsApp, native share sheet (where supported)
- [x] Tests: routes, meta, escaping, fallbacks, OG svg/png, vercel.json rewrite, WAV header/samples, share links, card layouts
- [ ] **On first deploy, verify** `/u/<name>/<year>` shows the right tags in a crawler debugger (the rewrite and `includeFiles` can't be exercised locally; the redirect fallback keeps it working if the template is missing)
- [ ] Set `PUBLIC_URL` on the deployment if it has a custom domain
- [ ] Try the native share sheet on a real phone

## Phase 4: Polish and launch
- [x] Error, empty ("quiet year") and loading states (done in Phase 2b)
- [ ] Accessibility pass
- [ ] Open Graph preview image
- [ ] README with demo; branding check
- [ ] Production deploy; monitor rate limits
