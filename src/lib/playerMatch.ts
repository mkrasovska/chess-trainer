import type { PgnGame } from './pgnUtils';

export type PlayerMatch = {
  name: string;
  fideId: string | null;
  gameCount: number;
};

export const MAX_PLAYERS = 100;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function playerKey(name: string, fideId: string | null): string {
  return fideId ? `id:${fideId}` : `name:${name}`;
}

/** Finds distinct player identities (by name+FIDE-ID) matching a name across a game list. */
export function findPlayersInGames(games: PgnGame[], term: string, maxPlayers: number): PlayerMatch[] {
  const matcher = new RegExp(escapeRegExp(term.trim()), 'i');
  const found = new Map<string, PlayerMatch>();

  outer: for (const game of games) {
    for (const side of ['White', 'Black'] as const) {
      const name = game.headers[side];
      if (!name || !matcher.test(name)) continue;

      const fideId = game.headers[`${side}FideId`] ?? null;
      const key = playerKey(name, fideId);
      const existing = found.get(key);
      if (existing) {
        existing.gameCount += 1;
      } else {
        if (found.size >= maxPlayers) break outer;
        found.set(key, { name, fideId, gameCount: 1 });
      }
    }
  }

  return Array.from(found.values()).sort((a, b) => b.gameCount - a.gameCount || a.name.localeCompare(b.name));
}

/**
 * The one player identity that appears in every game, if there's exactly one -- the
 * natural "whose archive is this" signal for a personal export, where the account
 * holder is on one side of every game while every opponent only shows up in however
 * many games they played against them. Lets a single-player source skip straight to
 * the games table instead of requiring a manual name search, same as Lichess (where
 * the player is already known from the username typed in).
 */
export function findSoleRecurringPlayer(games: PgnGame[]): PlayerMatch | null {
  if (games.length === 0) return null;
  const recurring = findPlayersInGames(games, '', Infinity).filter((p) => p.gameCount === games.length);
  return recurring.length === 1 ? recurring[0] : null;
}

/** All games where this exact player identity (name+FIDE-ID) played either side. */
export function getGamesForPlayer(games: PgnGame[], name: string, fideId: string | null): PgnGame[] {
  return games.filter(
    (game) =>
      (game.headers.White === name && (game.headers.WhiteFideId ?? null) === fideId) ||
      (game.headers.Black === name && (game.headers.BlackFideId ?? null) === fideId),
  );
}
