import { Chess } from 'chess.js';
import type { PgnGame } from './pgnUtils';

function sanHistoryMatches(raw: string, moveSans: string[]): boolean {
  try {
    const chess = new Chess();
    chess.loadPgn(raw);
    const history = chess.history();
    if (history.length < moveSans.length) return false;
    for (let i = 0; i < moveSans.length; i++) {
      if (history[i] !== moveSans[i]) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Games whose actual move sequence starts with exactly this line (SAN, both colors). */
export function getGamesMatchingMoveSequence(games: PgnGame[], moveSans: string[]): PgnGame[] {
  if (moveSans.length === 0) return games;
  return games.filter((game) => sanHistoryMatches(game.raw, moveSans));
}
