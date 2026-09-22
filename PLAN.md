# Chess Trainer — Plan

## Stack
React (Vite, TS) + `chess.js` + `react-chessboard` + `stockfish` (wasm, Web Worker). No backend.

## Features

### Core (3-day MVP)
1. Chessboard — render position, legal-move drag/drop
2. PGN import — paste/upload, move list with navigation (first/prev/next/last, click-to-jump)
3. Stockfish analysis — live eval bar + best-move arrow for current position
4. Player/game lookup — Lichess API: search username, list recent games, load into viewer
5. Full-game auto-analysis — eval at every move, flag blunders/mistakes/inaccuracies
6. Local persistence — IndexedDB, save/reopen analyzed games
7. Deploy — Vercel/Netlify static build

### Stretch / future
- TWIC (The Week in Chess) archive as a second game source — see notes below
- Opening explorer / opening name detection
- Puzzle/training mode (spaced repetition on own blunders)
- **"Train me against this player"** — AI opponent that emulates a specific player's style, informed by their historical games (opening repertoire weighting and/or LLM-assisted move selection), for sparring practice
- LLM-based natural-language commentary on top of Stockfish lines
- Multi-engine or multi-depth comparison

## Game data sources

**Lichess API** (primary, core MVP)
- REST, no auth needed for public data
- Query by username directly — good for "find a specific player" fast

**TWIC Archive** (stretch, secondary)
- Weekly PGN archives of elite/OTB tournament games, free for personal/non-commercial use (check twic site terms before any redistribution)
- No REST API — static zip/PGN file downloads only, no per-player query endpoint
- Integration = fetch a week's archive client-side, unzip (JS zip lib), parse PGN headers, search for player name locally
- Good complement to Lichess: covers strong OTB players/games that rarely appear in Lichess's online-game database
- Heavier client-side cost (large files, in-browser search) — worth adding once core MVP works, not day 1-3

## Implementation order

**Day 1 — Foundation**
- Board component + chess.js game state
- PGN parser + move list panel with navigation

**Day 2 — Engine + data source**
- Stockfish Web Worker: eval bar, best-move arrow, depth setting
- Lichess integration: player search → game list → load into board/PGN viewer

**Day 3 — Analysis, persistence, ship**
- Auto-analyze full game → mistake/blunder tagging on move list
- IndexedDB save/load
- UI polish, deploy
