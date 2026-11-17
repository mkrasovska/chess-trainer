import { useCallback, useMemo, useRef, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import { getYear } from '../lib/gameStats';
import { parsePgnHeaders } from '../lib/pgnUtils';

export type LoadedGameInfo = {
  white: string;
  black: string;
  year: number | null;
};

function computeFens(moves: Move[], startFen?: string): string[] {
  const scratch = startFen ? new Chess(startFen) : new Chess();
  const fens = [scratch.fen()];
  for (const move of moves) {
    scratch.move(move.san);
    fens.push(scratch.fen());
  }
  return fens;
}

type Branch = {
  startPly: number;
  game: Chess;
};

export function useChessGame() {
  const [game] = useState(() => new Chess());
  const [moves, setMoves] = useState<Move[]>([]);
  const [currentPly, setCurrentPly] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [gameInfo, setGameInfo] = useState<LoadedGameInfo | null>(null);

  const branchRef = useRef<Branch | null>(null);
  const [branchMoves, setBranchMoves] = useState<Move[]>([]);
  const [isBranching, setIsBranching] = useState(false);

  const fens = useMemo(() => computeFens(moves), [moves]);

  const exitBranch = useCallback(() => {
    branchRef.current = null;
    setBranchMoves([]);
    setIsBranching(false);
  }, []);

  const branchFens = useMemo(
    () => (isBranching ? computeFens(branchMoves, fens[currentPly]) : []),
    [isBranching, branchMoves, fens, currentPly],
  );

  const currentFen = isBranching && branchRef.current
    ? branchRef.current.game.fen()
    : (fens[currentPly] ?? fens[fens.length - 1]);

  const isAtLatest = !isBranching && currentPly === moves.length;

  // The position before, and SAN of, whichever move led to the current position
  // (mainline or branch) -- used for on-demand move analysis.
  const previousFen = isBranching
    ? (branchFens.length >= 2 ? branchFens[branchFens.length - 2] : fens[currentPly])
    : (currentPly > 0 ? fens[currentPly - 1] : null);

  const lastMoveSan = isBranching
    ? (branchMoves[branchMoves.length - 1]?.san ?? null)
    : (currentPly > 0 ? (moves[currentPly - 1]?.san ?? null) : null);

  const loadPgn = useCallback((pgn: string) => {
    try {
      game.loadPgn(pgn);
      const loadedMoves = game.history({ verbose: true });
      setMoves(loadedMoves);
      setCurrentPly(loadedMoves.length);
      exitBranch();
      setError(null);

      const headers = parsePgnHeaders(pgn);
      setGameInfo({
        white: headers.White || 'Unknown',
        black: headers.Black || 'Unknown',
        year: getYear(headers),
      });
    } catch {
      setError('Could not parse this PGN.');
    }
  }, [game, exitBranch]);

  const makeMove = useCallback((from: string, to: string, promotion = 'q') => {
    // At the end of the mainline with no active branch: just extend the game as before.
    if (!isBranching && currentPly === moves.length) {
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
    }

    // Starting a new branch from wherever we currently are.
    if (!isBranching) {
      const startFen = fens[currentPly];
      const branchGame = new Chess(startFen);
      try {
        branchGame.move({ from, to, promotion });
      } catch {
        return false;
      }
      branchRef.current = { startPly: currentPly, game: branchGame };
      setBranchMoves(branchGame.history({ verbose: true }));
      setIsBranching(true);
      return true;
    }

    // Already branching: keep extending it.
    const branch = branchRef.current;
    if (!branch) return false;
    try {
      branch.game.move({ from, to, promotion });
    } catch {
      return false;
    }
    setBranchMoves(branch.game.history({ verbose: true }));
    return true;
  }, [game, moves, currentPly, fens, isBranching]);

  const goToPly = useCallback((ply: number) => {
    exitBranch();
    setCurrentPly(Math.max(0, Math.min(ply, moves.length)));
  }, [moves.length, exitBranch]);

  const goFirst = useCallback(() => goToPly(0), [goToPly]);
  const goLast = useCallback(() => goToPly(moves.length), [goToPly, moves.length]);

  const goPrev = useCallback(() => {
    if (isBranching && branchRef.current) {
      branchRef.current.game.undo();
      const remaining = branchRef.current.game.history({ verbose: true });
      if (remaining.length === 0) {
        exitBranch();
      } else {
        setBranchMoves(remaining);
      }
      return;
    }
    goToPly(currentPly - 1);
  }, [isBranching, currentPly, goToPly, exitBranch]);

  const goNext = useCallback(() => {
    if (isBranching) return;
    goToPly(currentPly + 1);
  }, [isBranching, currentPly, goToPly]);

  const returnToMainline = useCallback(() => {
    exitBranch();
  }, [exitBranch]);

  const reset = useCallback(() => {
    game.reset();
    setMoves([]);
    setCurrentPly(0);
    setError(null);
    setGameInfo(null);
    exitBranch();
  }, [game, exitBranch]);

  return {
    moves,
    fens,
    currentPly,
    currentFen,
    previousFen,
    lastMoveSan,
    gameInfo,
    isAtLatest,
    isBranching,
    branchMoves,
    error,
    loadPgn,
    makeMove,
    goToPly,
    goFirst,
    goPrev,
    goNext,
    goLast,
    returnToMainline,
    reset,
  };
}

export type UseChessGame = ReturnType<typeof useChessGame>;
