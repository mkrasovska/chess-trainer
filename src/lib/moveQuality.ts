import type { PositionEval } from './analysisEngine';

export type MoveQuality = 'blunder' | 'mistake' | 'inaccuracy' | 'best';

export const MOVE_QUALITY_SYMBOL: Record<MoveQuality, string> = {
  blunder: '??',
  mistake: '?',
  inaccuracy: '?!',
  best: '!',
};

const MATE_SCORE = 100000;

/** Converts a position's score to one comparable number, from the side-to-move's perspective. */
function toComparable({ scoreCp, scoreMate }: PositionEval): number {
  if (scoreMate !== null) {
    return scoreMate > 0 ? MATE_SCORE - scoreMate : -MATE_SCORE - scoreMate;
  }
  return scoreCp ?? 0;
}

/**
 * The centipawn swing (always >= 0) between before/after, from the mover's own
 * perspective. `before` is the best achievable score for the side about to move
 * (mover's perspective already). `after` is evaluated from the opponent's perspective
 * (since the turn flipped), so it's negated to compare on the same scale.
 */
export function computeSwing(before: PositionEval, after: PositionEval): number {
  const bestForMover = toComparable(before);
  const resultForMover = -toComparable(after);
  return Math.max(0, bestForMover - resultForMover);
}

/** Classifies the move played between positionEvals[i] and positionEvals[i+1] for ply i. */
export function classifyMove(before: PositionEval, after: PositionEval): MoveQuality {
  const swing = computeSwing(before, after);

  if (swing >= 300) return 'blunder';
  if (swing >= 130) return 'mistake';
  if (swing >= 50) return 'inaccuracy';
  return 'best';
}

export function classifyGame(positionEvals: PositionEval[]): (MoveQuality | null)[] {
  const classifications: (MoveQuality | null)[] = [];
  for (let i = 0; i < positionEvals.length - 1; i++) {
    classifications.push(classifyMove(positionEvals[i], positionEvals[i + 1]));
  }
  return classifications;
}
