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
- [ ] Canvas heatmap with playhead synced to Transport
- [ ] Note pulses by level; responsive; `prefers-reduced-motion`

## Phase 3: Share
- [ ] PNG share card
- [ ] Share link `/?u=&y=` with URL state
- [ ] Copy link / download buttons

## Phase 4: Polish and launch
- [ ] Error, empty ("quiet year") and loading states
- [ ] Accessibility pass
- [ ] Open Graph preview image
- [ ] README with demo; branding check
- [ ] Production deploy; monitor rate limits
