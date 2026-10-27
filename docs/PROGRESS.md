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
- [ ] Pure mapping `data → note events` + tests
- [ ] Tone.js playback, lazy-loaded on Play; stop/replay
- [ ] Scale/mood selection from yearly stats; tune by ear on all four fixtures
- [ ] Verify duration is 30 s (52 beats at 104 BPM)

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
