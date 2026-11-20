import { Chess } from 'chess.js';
import type { PositionEval } from './analysisEngine';
import { formatScore, moverPerspective, pvToSanLine, sanToUci } from './evalFormat';
import { classifyMove, computeSwing, type MoveQuality } from './moveQuality';

const QUALITY_DESCRIPTION: Record<MoveQuality, string> = {
  best: 'fine / not a mistake',
  inaccuracy: 'a small inaccuracy',
  mistake: 'a real mistake',
  blunder: 'a serious blunder',
};

export function buildMoveAnalysisPrompt(params: {
  fenBefore: string;
  moveSan: string;
  moverColor: 'w' | 'b';
  evalBefore: PositionEval;
  evalAfter: PositionEval;
}): string {
  const { fenBefore, moveSan, moverColor, evalBefore, evalAfter } = params;
  const moverName = moverColor === 'w' ? 'White' : 'Black';

  // Each MultiPV rank is its own full line from fenBefore -- give each one its own
  // grounding (not just the engine's single favorite like before), so the model can
  // explain what makes every candidate strong, not only the top one.
  const playedUci = sanToUci(fenBefore, moveSan);
  const candidates = evalBefore.candidates
    .map((c) => ({
      san: pvToSanLine(fenBefore, c.pv, 1),
      line: pvToSanLine(fenBefore, c.pv, 6),
      score: formatScore(c.scoreCp, c.scoreMate),
      isPlayed: c.moveUci === playedUci,
    }))
    .filter((c) => c.san !== '');

  // candidates[0] is the engine's own rank-1 choice -- if that's what was played,
  // nothing can score higher by definition, so it's always "best". Deriving its
  // classification the normal way (comparing evalBefore to a fresh search of the
  // resulting position, evalAfter) can disagree with the candidate's own number by a
  // few centipawns of search noise -- different root, different depth budget -- which
  // previously could spuriously call the literal best move an inaccuracy or worse.
  const isBestMove = candidates[0]?.isPlayed === true;
  const quality: MoveQuality = isBestMove ? 'best' : classifyMove(evalBefore, evalAfter);
  const swingNote = !isBestMove && evalBefore.scoreMate === null && evalAfter.scoreMate === null
    ? `, net change ${(computeSwing(evalBefore, evalAfter) / 100).toFixed(2)} pawns worse`
    : '';
  const classificationNote = ` -- engine classification: ${quality} (${QUALITY_DESCRIPTION[quality]}${isBestMove ? ' -- this is the engine\'s own top choice here' : swingNote})`;

  // If the move played is already one of the candidates above, annotate that entry
  // as "(played)" instead of also analyzing it as a separate move -- a fresh search
  // from the resulting position could (and did) disagree with the candidate's own
  // score/line for what is the exact same move.
  const playedIsCandidate = candidates.some((c) => c.isPlayed);
  let moves: { san: string; line: string; score: string; note: string }[];
  if (playedIsCandidate) {
    moves = candidates.map((c) => ({
      san: c.san,
      line: c.line,
      score: c.score,
      note: c.isPlayed ? ` (played)${classificationNote}` : '',
    }));
  } else {
    const game = new Chess(fenBefore);
    let fenAfter = fenBefore;
    try {
      game.move(moveSan);
      fenAfter = game.fen();
    } catch {
      // moveSan should always be legal from fenBefore since it's the move actually played;
      // fall back to fenBefore if something unexpected happens.
    }
    const playedLine = pvToSanLine(fenAfter, evalAfter.pv, 6);
    const afterForMover = moverPerspective(evalAfter);
    moves = [
      { san: moveSan, line: playedLine, score: formatScore(afterForMover.scoreCp, afterForMover.scoreMate), note: ` (played)${classificationNote}` },
      ...candidates.map((c) => ({ san: c.san, line: c.line, score: c.score, note: '' })),
    ];
  }

  const movesBlock = moves.map((m, i) => `${i + 1}. ${m.san}${m.note} -- score ${m.score} -- line: ${m.line}`).join('\n');
  const replyFormat = moves.map((m) => `${m.san}: <1-2 short sentences>`).join('\n');

  return `You are a chess coach. ${moverName} just played ${moveSan} in this position (FEN before the move): ${fenBefore}

Moves in this position, all scored for ${moverName}:
${movesBlock}

Reply in EXACTLY this format -- one short paragraph per move above, in the same order, nothing else (no intro, no closing summary, no restating the numbers above):
${replyFormat}

Each move's explanation: 1-2 short sentences, like a coach explaining the actual idea behind that move in plain language (e.g. what tactic or positional idea makes it work) -- not just a one-word label, but don't pad it either. For whichever move above is marked "played", calibrate strictly to its classification note -- if it says this is the engine's own top choice, say so plainly (it's the best move, full stop, not merely "solid" or "fine"); if it says "fine / not a mistake" without that, call it solid/normal; either way, NOT a blunder, mistake, or game-changer, even if another move above happens to show a higher score. For every move, only mention a tactic, pin, or fork if it is visible in THAT move's own line above -- never invent one that isn't shown there. Do not repeat the same point across lines, and don't summarize at the end.`;
}
