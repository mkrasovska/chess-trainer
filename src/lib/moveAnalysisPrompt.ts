import { Chess } from 'chess.js';
import type { PositionEval } from './analysisEngine';

function formatScore(scoreCp: number | null, scoreMate: number | null): string {
  if (scoreMate !== null) return scoreMate > 0 ? `mate in ${scoreMate}` : `getting mated in ${Math.abs(scoreMate)}`;
  if (scoreCp !== null) return `${(scoreCp / 100).toFixed(2)} pawns`;
  return 'unknown';
}

function pvToSanLine(fen: string, pvUci: string[], maxMoves = 5): string {
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

export function buildMoveAnalysisPrompt(params: {
  fenBefore: string;
  moveSan: string;
  moverColor: 'w' | 'b';
  evalBefore: PositionEval;
  evalAfter: PositionEval;
}): string {
  const { fenBefore, moveSan, moverColor, evalBefore, evalAfter } = params;
  const moverName = moverColor === 'w' ? 'White' : 'Black';

  // evalBefore.pv is the engine's full suggested line starting with its best move;
  // use it wholesale rather than just the bare best move, so the "better line" shown
  // is an actual multi-move continuation, not the same single move repeated.
  const bestLine = evalBefore.bestMoveUci ? pvToSanLine(fenBefore, evalBefore.pv) : '';
  const bestMoveSan = bestLine ? bestLine.split(' ')[0] : null;

  const game = new Chess(fenBefore);
  let fenAfter = fenBefore;
  try {
    game.move(moveSan);
    fenAfter = game.fen();
  } catch {
    // moveSan should always be legal from fenBefore since it's the move actually played;
    // fall back to fenBefore if something unexpected happens.
  }
  const continuationLine = pvToSanLine(fenAfter, evalAfter.pv);

  return `You are a chess coach. ${moverName} just played ${moveSan} in this position (FEN before the move): ${fenBefore}

Engine evaluation before the move (for the side to move, ${moverName}): ${formatScore(evalBefore.scoreCp, evalBefore.scoreMate)}
Engine evaluation after ${moveSan} was played: ${formatScore(evalAfter.scoreCp, evalAfter.scoreMate)}
${bestMoveSan ? `The engine's top move instead of ${moveSan} was: ${bestMoveSan}${bestLine ? ` (${bestLine})` : ''}` : ''}
${continuationLine ? `The engine's suggested continuation after ${moveSan}: ${continuationLine}` : ''}

In 3-4 short sentences: say how good or bad ${moveSan} was, and if ${bestMoveSan ?? 'a different move'} would have been meaningfully better, explain briefly why in plain language (e.g. what tactic or positional idea makes it stronger). Don't just restate the raw numbers above. Be direct and concise, like a coach reviewing a student's game.`;
}
