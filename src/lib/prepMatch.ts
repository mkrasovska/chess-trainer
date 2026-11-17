import { Chess } from 'chess.js';

/**
 * The game's full SAN move history, if it starts with exactly this line (both
 * colors, in order); null if the game is shorter than the line or diverges from it.
 */
export function historyIfMatchesPrefix(raw: string, moveSans: string[]): string[] | null {
  try {
    const chess = new Chess();
    chess.loadPgn(raw);
    const history = chess.history();
    if (history.length < moveSans.length) return null;
    for (let i = 0; i < moveSans.length; i++) {
      if (history[i] !== moveSans[i]) return null;
    }
    return history;
  } catch {
    return null;
  }
}
