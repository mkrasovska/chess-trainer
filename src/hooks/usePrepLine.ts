import { useCallback, useState } from 'react';
import { Chess, type Move } from 'chess.js';

export function usePrepLine() {
  const [game] = useState(() => new Chess());
  const [moves, setMoves] = useState<Move[]>([]);

  const fen = game.fen();

  // No ply cap -- chess.js itself has none, and a move that runs the game out
  // (checkmate/stalemate) just throws here and is swallowed below, same as any
  // other illegal move.
  const applyMove = useCallback((mutate: () => void) => {
    try {
      mutate();
      setMoves(game.history({ verbose: true }));
      return true;
    } catch {
      return false;
    }
  }, [game]);

  const makeMove = useCallback(
    (from: string, to: string, promotion = 'q') => applyMove(() => game.move({ from, to, promotion })),
    [applyMove, game],
  );

  const makeMoveSan = useCallback((san: string) => applyMove(() => game.move(san)), [applyMove, game]);

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

  return { fen, moves, makeMove, makeMoveSan, undo, truncateTo, reset };
}
