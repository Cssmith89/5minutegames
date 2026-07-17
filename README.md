# 5 Minute Games

The game catalog for [5minutegames.gg](https://5minutegames.gg) — a Next.js site that
hosts browser-playable games. Games are exported to HTML5/WebAssembly by their own
engine (Godot, for now) and served as static files; this app is just the catalog,
game pages, and player shell around them.

## Stack

Next.js 16 (App Router) + React 19 + Tailwind 4 + TypeScript. No database, no auth —
the game catalog is a small hand-maintained list in `src/lib/games.ts`, not
user-generated content.

## Structure

- `src/lib/games.ts` — the catalog: one `GameEntry` object per game (title,
  description, controls, path to its build, playable/coming-soon status).
- `src/app/page.tsx` — homepage, grid of `GameCard`s.
- `src/app/games/[slug]/page.tsx` — per-game page, renders `GamePlayer` for
  playable games.
- `src/components/GamePlayer.tsx` — the iframe-based player: click-to-play gate
  (avoids auto-loading a large WASM build), fullscreen toggle.
- `public/games/<slug>/build/` — each game's exported static build, served
  directly. `public/games/<slug>/thumbnail.png` — its catalog card image. These
  are committed to git (not gitignored) — they're site content, not a build
  artifact of this repo.

## Adding a new game

1. Export the game to Web/HTML5 (see below for Godot).
2. Copy the exported build into `public/games/<slug>/build/` and add a
   `public/games/<slug>/thumbnail.png`.
3. Append a `GameEntry` to `src/lib/games.ts` with `status: "playable"`.
4. `npm run dev` and check `/games/<slug>` locally before pushing.

## Exporting a Godot game to Web (manual, one-time setup + per-release)

Godot doesn't have a locatable CLI on this machine, so exporting is done from the
editor GUI:

1. Open the project in Godot. **Editor → Manage Export Templates** → install the
   templates matching the project's Godot version (one-time, ~1-2GB download).
2. **Project → Export... → Add... → Web** to create a Web export preset.
   - Leave **Threads Support unchecked** — this keeps the build off
     `SharedArrayBuffer`, so no `Cross-Origin-Opener-Policy` /
     `Cross-Origin-Embedder-Policy` headers are needed on this site.
   - Set the export path/base filename to the game's slug (e.g.
     `dungeon-crawler`) so exported files are named predictably.
3. **Export Project**. Confirm the output has `index.html`, a `.wasm`, a `.pck`,
   and a `.js` file.
4. Smoke-test the export standalone before touching this repo: serve the export
   folder with a real static server (e.g. `npx serve <folder>`) — opening
   `index.html` directly via `file://` will not work, WASM/fetch loading
   requires HTTP.
5. Copy the export output into `public/games/<slug>/build/` here.

Godot's exported filenames aren't content-hashed, so after re-exporting an
existing game, browsers may briefly serve a stale cached `.pck` against a new
`index.html` (or vice versa) — see the `Cache-Control` handling if this becomes
a problem in practice.

## Deploying

1. Push to GitHub, import the repo in [Vercel](https://vercel.com/new). No env
   vars needed. Framework preset auto-detects Next.js.
2. Verify the `*.vercel.app` preview URL end-to-end (catalog, game page, the
   game actually loads and plays) before touching DNS.
3. In Vercel: Project Settings → Domains → add `5minutegames.gg`. Vercel shows
   the exact DNS records to add.
4. In GoDaddy's DNS management for `5minutegames.gg`: remove any existing
   "parked domain" records, add the records Vercel specified.
5. Wait for DNS propagation / SSL issuance (Vercel's Domains page shows
   status), then re-test the live game at the real domain.

## Things that commonly break with Godot web exports

- Large initial load (`.wasm`/`.pck` can be tens of MB) — check load time and
  whether Godot's own loading bar shows properly rather than a blank screen.
- Keyboard input requires the iframe to have focus — the click-to-play gate in
  `GamePlayer` handles this, but verify it's obvious to a first-time visitor.
- Mobile: games with no on-screen touch controls (like the dungeon crawler)
  won't be playable on phones — consider a "best played on desktop" note.
- Audio autoplay is blocked until user interaction; Godot generally handles
  this by starting the audio context on first input, but verify with sound on.
