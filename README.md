# Commit Symphony

Turn your yearly contribution graph into a ~30-second song with a synced visual, a shareable card and a link.
Free and open source, for GitHub users. Not affiliated with or endorsed by GitHub.

## Develop

```sh
npm install
npm run dev     # uses fixtures; try the usernames active, weekend, burst, empty
npm test
npm run build
```

To use real data, copy `.env.example` to `.env` and set `GITHUB_TOKEN` (server-side only, no scopes needed).

## API

`GET /api/contributions?user=<login>&year=<yyyy>` returns
`{ user, year, weeks: (0|1|2|3|4)[52][7], total, topLanguages }`, cached ~6 hours.

See `docs/PLAN.md` for the architecture and how contributions become music. Licensed MIT.
