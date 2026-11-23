import { Chess } from 'chess.js';
import type { CandidateMove, PositionEval } from './analysisEngine';

export function formatScore(scoreCp: number | null, scoreMate: number | null): string {
  if (scoreMate !== null) return scoreMate > 0 ? `mate in ${scoreMate}` : `getting mated in ${Math.abs(scoreMate)}`;
  if (scoreCp !== null) return (scoreCp / 100).toFixed(2);
  return 'unknown';
}

/**
 * `afterEval` is evaluated at the position right after a move was played, where it's
 * now the opponent's turn, so its score is from the opponent's perspective. Flips it
 * to the mover's own perspective so it's directly comparable to a before-the-move
 * (or candidate-move) score instead of silently crossing zero for a move that barely
 * changed anything.
 */
export function moverPerspective(afterEval: PositionEval): { scoreCp: number | null; scoreMate: number | null } {
  return {
    scoreCp: afterEval.scoreCp !== null ? -afterEval.scoreCp : null,
    scoreMate: afterEval.scoreMate !== null ? -afterEval.scoreMate : null,
  };
}

/** Converts a SAN move played from `fen` to its UCI form, for comparing against a
 *  CandidateMove's `moveUci` (SAN alone isn't a safe key -- e.g. disambiguation). */
export function sanToUci(fen: string, san: string): string | null {
  const game = new Chess(fen);
  try {
    const move = game.move(san);
    return `${move.from}${move.to}${move.promotion ?? ''}`;
  } catch {
    return null;
  }
}

export type RankedCandidate = {
  san: string;
  line: string;
  score: string;
  moveUci: string;
  isPlayed: boolean;
};

// candidates are MultiPV ranks evaluated at `fen`, so they're all from the same side
// to move -- no perspective flip needed, unlike comparing before/after a move. Always
// lists every candidate (even one matching `playedUci`) rather than dropping it, so
// a move the player actually made still shows up in the list -- just flagged via
// `isPlayed` instead of being torn out and re-analyzed as a separate entry (which is
// what previously caused it to get a second, inconsistent score/explanation).
export function formatRankedCandidates(fen: string, candidates: CandidateMove[], playedUci: string | null): RankedCandidate[] {
  return candidates
    .map((c) => ({
      san: pvToSanLine(fen, c.pv, 1),
      line: pvToSanLine(fen, c.pv, 6),
      score: formatScore(c.scoreCp, c.scoreMate),
      moveUci: c.moveUci,
      isPlayed: c.moveUci === playedUci,
    }))
    .filter((c) => c.san !== '');
}

export function pvToSanLine(fen: string, pvUci: string[], maxMoves = 5): string {
  const game = new Chess(fen);
  const sans: string[] = [];
  for (const uci of pvUci.slice(0, maxMoves)) {
    try {
      const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || undefined });
      sans.push(move.san);
    } catch {
      break;
    }
  }
  return sans.join(' ');
}
