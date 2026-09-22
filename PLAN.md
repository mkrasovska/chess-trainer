# Chess Trainer — Plan

## Stack
React (Vite, TS) + `chess.js` + `react-chessboard` + `stockfish` (wasm, Web Worker). No backend.

## Features

### Core (3-day MVP)
1. Chessboard — render position, legal-move drag/drop
2. PGN import — paste/upload, move list with navigation (first/prev/next/last, click-to-jump)
3. Stockfish analysis — live eval bar + best-move arrow for current position
4. Player/game lookup — manual PGN paste + TWIC archive upload (search by player name), see notes below
5. Full-game auto-analysis — eval at every move, flag blunders/mistakes/inaccuracies
6. Local persistence — IndexedDB, save/reopen analyzed games
7. Deploy — Vercel/Netlify static build

### Stretch / future
- Lichess API integration (see note below — currently blocked)
- Opening explorer / opening name detection
- Puzzle/training mode (spaced repetition on own blunders)
- **"Train me against this player"** — AI opponent that emulates a specific player's style, informed by their historical games (opening repertoire weighting and/or LLM-assisted move selection), for sparring practice
- LLM-based natural-language commentary on top of Stockfish lines
- Multi-engine or multi-depth comparison

## Game data sources

**Lichess API** — blocked, dropped from core scope
- Live-tested 2026-09-22: `/api/games/user/{username}` and `/api/game/export/{id}` both 404 for every account tried, including Lichess's own docs example user, while `/api/user/{username}` and `/api/player/autocomplete` work fine. Bulk/individual game export appears down or re-gated beyond what the published spec (github.com/lichess-org/api) describes.
- Also not CORS-friendly for a pure client-side rebuild if Lichess ever requires an authenticated proxy — would need a backend, which is out of scope (no BE).
- Revisit later if the outage resolves or with a personal OAuth token.

**TWIC Archive** (implemented, Day 2)
- Weekly PGN archives of elite/OTB tournament games, free for personal/non-commercial use (check twic site terms before any redistribution)
- theweekinchess.com does **not** send CORS headers, so the .zip can't be `fetch()`ed directly from the browser — implemented as a manual file upload instead (user downloads the .zip from TWIC themselves, uploads it into the app)
- Client-side unzip via `fflate` (`unzipSync`/`strFromU8`), PGN text split into individual games via a `[Event ` boundary regex, headers parsed with a small regex, filtered client-side by player name substring on White/Black headers
- Verified against a real archive (twic1663g.zip, 10,030 games) — player filter and game load both work

**Manual PGN paste** (implemented, Day 1)
- Covers loading any single game from anywhere (Lichess, chess.com, TWIC, etc.) regardless of API availability

## Implementation order

**Day 1 — Foundation**
- Board component + chess.js game state
- PGN parser + move list panel with navigation

**Day 2 — Engine + data source** (done)
- Stockfish Web Worker: eval bar, best-move arrow, depth setting
- TWIC archive upload: unzip client-side, parse games, filter by player, load into board/PGN viewer

**Day 3 — Analysis, persistence, ship**
- Auto-analyze full game → mistake/blunder tagging on move list
- IndexedDB save/load
- UI polish, deploy
