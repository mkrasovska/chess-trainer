import { useCallback, useMemo, useState } from 'react';
import { Chess, type Move } from 'chess.js';

function computeFens(moves: Move[]): string[] {
  const scratch = new Chess();
  const fens = [scratch.fen()];
  for (const move of moves) {
    scratch.move(move.san);
    fens.push(scratch.fen());
  }
  return fens;
}

export function useChessGame() {
  const [game] = useState(() => new Chess());
  const [moves, setMoves] = useState<Move[]>([]);
  const [currentPly, setCurrentPly] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fens = useMemo(() => computeFens(moves), [moves]);
  const currentFen = fens[currentPly] ?? fens[fens.length - 1];
  const isAtLatest = currentPly === moves.length;

  const loadPgn = useCallback((pgn: string) => {
    try {
      game.loadPgn(pgn);
      const loadedMoves = game.history({ verbose: true });
      setMoves(loadedMoves);
      setCurrentPly(loadedMoves.length);
      setError(null);
    } catch {
      setError('Could not parse this PGN.');
    }
  }, [game]);

  const makeMove = useCallback((from: string, to: string, promotion = 'q') => {
    if (!isAtLatest) return false;
    try {
      game.move({ from, to, promotion });
      const updatedMoves = game.history({ verbose: true });
      setMoves(updatedMoves);
      setCurrentPly(updatedMoves.length);
      setError(null);
      return true;
    } catch {
      return false;
    }
  }, [game, isAtLatest]);

  const goToPly = useCallback((ply: number) => {
    setCurrentPly(Math.max(0, Math.min(ply, moves.length)));
  }, [moves.length]);

  const goFirst = useCallback(() => goToPly(0), [goToPly]);
  const goPrev = useCallback(() => goToPly(currentPly - 1), [goToPly, currentPly]);
  const goNext = useCallback(() => goToPly(currentPly + 1), [goToPly, currentPly]);
  const goLast = useCallback(() => goToPly(moves.length), [goToPly, moves.length]);

  const reset = useCallback(() => {
    game.reset();
    setMoves([]);
    setCurrentPly(0);
    setError(null);
  }, [game]);

  return {
    moves,
    currentPly,
    currentFen,
    isAtLatest,
    error,
    loadPgn,
    makeMove,
    goToPly,
    goFirst,
    goPrev,
    goNext,
    goLast,
    reset,
  };
}

export type UseChessGame = ReturnType<typeof useChessGame>;
