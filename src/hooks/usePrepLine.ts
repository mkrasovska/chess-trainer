import { useCallback, useState } from 'react';
import { Chess, type Move } from 'chess.js';

export const PREP_MAX_PLIES = 10; // 5 full moves

export function usePrepLine() {
  const [game] = useState(() => new Chess());
  const [moves, setMoves] = useState<Move[]>([]);

  const fen = game.fen();
  const atMax = moves.length >= PREP_MAX_PLIES;

  const makeMove = useCallback(
    (from: string, to: string, promotion = 'q') => {
      if (moves.length >= PREP_MAX_PLIES) return false;
      try {
        game.move({ from, to, promotion });
        setMoves(game.history({ verbose: true }));
        return true;
      } catch {
        return false;
      }
    },
    [game, moves.length],
  );

  const makeMoveSan = useCallback(
    (san: string) => {
      if (moves.length >= PREP_MAX_PLIES) return false;
      try {
        game.move(san);
        setMoves(game.history({ verbose: true }));
        return true;
      } catch {
        return false;
      }
    },
    [game, moves.length],
  );

  const undo = useCallback(() => {
    game.undo();
    setMoves(game.history({ verbose: true }));
  }, [game]);

  // Jumps back to right after the ply-th move (1-indexed), dropping everything after it.
  const truncateTo = useCallback((ply: number) => {
    while (game.history().length > ply) game.undo();
    setMoves(game.history({ verbose: true }));
  }, [game]);

  const reset = useCallback(() => {
    game.reset();
    setMoves([]);
  }, [game]);

  return { fen, moves, makeMove, makeMoveSan, undo, truncateTo, reset, atMax, maxPlies: PREP_MAX_PLIES };
}
