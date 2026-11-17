import { Chess } from 'chess.js';

/** A game's full SAN move history, or null if it can't be parsed. */
export function getHistory(raw: string): string[] | null {
  try {
    const chess = new Chess();
    chess.loadPgn(raw);
    return chess.history();
  } catch {
    return null;
  }
}

/** Whether `history` starts with exactly this line (both colors, in order). */
export function historyMatchesPrefix(history: string[] | null, moveSans: string[]): boolean {
  if (!history || history.length < moveSans.length) return false;
  for (let i = 0; i < moveSans.length; i++) {
    if (history[i] !== moveSans[i]) return false;
  }
  return true;
}
