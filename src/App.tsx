import { useEffect, useMemo, useRef, useState } from 'react';
import { Board, DEFAULT_BOARD_SIZE } from './components/Board';
import { EvalBar } from './components/EvalBar';
import { GameArchiveImport } from './components/GameArchiveImport';
import { GamesTable } from './components/GamesTable';
import { LichessImport } from './components/LichessImport';
import { MoveAnalysis } from './components/MoveAnalysis';
import { MoveList } from './components/MoveList';
import { PgnImport } from './components/PgnImport';
import { Stepper, type Step } from './components/Stepper';
import { useChessGame } from './hooks/useChessGame';
import { useGameAnalysis } from './hooks/useGameAnalysis';
import { useStockfish } from './hooks/useStockfish';
import { useViewportWidth } from './hooks/useViewportWidth';
import { loadLibraryGames } from './lib/gameLibrary';
import { getGamesForPlayer, type PlayerMatch } from './lib/playerMatch';
import type { PgnGame } from './lib/pgnUtils';
import './App.css';

type ImportTab = 'paste' | 'archive' | 'lichess';

function uciToArrow(uciMove: string) {
  return {
    startSquare: uciMove.slice(0, 2),
    endSquare: uciMove.slice(2, 4),
    color: 'rgba(0, 128, 0, 0.6)',
  };
}

function App() {
  const {
    moves,
    fens,
    currentPly,
    currentFen,
    previousFen,
    lastMoveSan,
    gameInfo,
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
  } = useChessGame();

  const { isReady, line, bestMove, evaluate } = useStockfish();
  const gameAnalysis = useGameAnalysis();
  const [importTab, setImportTab] = useState<ImportTab>('paste');
  const [currentStep, setCurrentStep] = useState<Step>(1);

  const handleLoadPgn = (pgn: string) => {
    gameAnalysis.clear();
    loadPgn(pgn);
  };

  // Switching import tabs should drop whatever game/position was loaded, not carry
  // it over to a tab the user is now looking at for a different purpose.
  const handleTabChange = (tab: ImportTab) => {
    setImportTab(tab);
    gameAnalysis.clear();
    reset();
    setCurrentStep(1);
  };

  const [selectedPlayer, setSelectedPlayer] = useState<PlayerMatch | null>(null);
  const [playerGames, setPlayerGames] = useState<PgnGame[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState(false);
  const [gamesStatus, setGamesStatus] = useState<string | null>(null);

  // What every source funnels into once it has resolved a player + their games:
  // one game means there's nothing to filter/compare, so skip step 2 entirely;
  // more than one advances to step 2 (the step-3 advance itself is handled below,
  // triggered uniformly by a game actually loading, from any path).
  const applyResolvedGames = (games: PgnGame[], player: PlayerMatch) => {
    setSelectedPlayer(player);
    setPlayerGames(games);
    if (games.length === 1) {
      handleLoadPgn(games[0].raw);
    } else if (games.length > 1) {
      setCurrentStep(2);
    }
  };

  useEffect(() => {
    if (isReady) evaluate(currentFen);
  }, [isReady, currentFen, evaluate]);

  // Advances to step 3 whenever a game actually (successfully) loads, regardless of
  // which path got there (single-game shortcut, or picking a row in step 2) -- and
  // regardless of whether a game was already loaded, so re-picking a different (or
  // even the same) row from step 2 jumps back to step 3 too. Compared by identity
  // rather than by "is it loaded" so this fires on every successful load, not just
  // the first one; a failed load leaves gameInfo's reference unchanged, so it
  // correctly never fires then, letting the error stay visible on step 1.
  const isGameLoaded = gameInfo !== null;
  const prevGameInfoRef = useRef(gameInfo);
  useEffect(() => {
    if (gameInfo !== null && gameInfo !== prevGameInfoRef.current) setCurrentStep(3);
    prevGameInfoRef.current = gameInfo;
  }, [gameInfo]);

  // Left/right arrow keys step through moves, same as the |< < > >| buttons, but only
  // while step 3 (the board) is actually visible -- otherwise they'd silently move a
  // piece you can't see. goPrev/goNext/currentStep are read through a ref rather than
  // listed as effect deps so one listener stays attached for the component's lifetime
  // instead of detaching/reattaching on every navigation.
  const navRef = useRef({ goPrev, goNext, currentStep });
  navRef.current = { goPrev, goNext, currentStep };
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (navRef.current.currentStep !== 3) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navRef.current.goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navRef.current.goNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sideToMove = (currentFen.split(' ')[1] === 'b' ? 'b' : 'w') as 'w' | 'b';
  const arrows = useMemo(() => (bestMove ? [uciToArrow(bestMove)] : []), [bestMove]);

  // react-chessboard measures its own rendered pixel size (ResizeObserver) and expects
  // a definite width/height -- sizing it purely through CSS (aspect-ratio etc.) previously
  // broke its internal grid rendering. Computing a real pixel size from the viewport here
  // keeps Board's literal-pixel-size contract intact while still shrinking it to fit next
  // to the eval bar on a narrow screen, instead of letting the row wrap.
  const BOARD_ROW_CHROME = 96; // .app side padding (32) + eval bar + gap (44) + safety margin (20)
  const viewportWidth = useViewportWidth();
  const boardSize = Math.max(200, Math.min(DEFAULT_BOARD_SIZE, viewportWidth - BOARD_ROW_CHROME));

  const handleBackToPlayers = () => {
    setSelectedPlayer(null);
    setPlayerGames([]);
    setGamesStatus(null);
  };

  const handleSelectPlayer = async (player: PlayerMatch) => {
    setIsLoadingGames(true);
    setGamesStatus(null);
    try {
      const games = await loadLibraryGames();
      const matched = getGamesForPlayer(games, player.name, player.fideId);
      setGamesStatus(`Found ${matched.length} game${matched.length === 1 ? '' : 's'}.`);
      applyResolvedGames(matched, player);
    } catch {
      setGamesStatus('Could not load games for this player.');
    } finally {
      setIsLoadingGames(false);
    }
  };

  const step2Reachable = selectedPlayer !== null && playerGames.length > 1;
  const step3Reachable = isGameLoaded;

  return (
    <div className="app">
      <div className="app__header">
        <div className="app__brand">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="app__logo" />
          <h1 className="sr-only">ChessPoint</h1>
        </div>
      </div>

      <Stepper
        currentStep={currentStep}
        step2Reachable={step2Reachable}
        step3Reachable={step3Reachable}
        onSelectStep={setCurrentStep}
      />

      <div style={{ display: currentStep === 1 ? undefined : 'none' }}>
        <div role="tablist" className="tabs tabs-boxed app__tabs">
          <button
            type="button"
            role="tab"
            className={importTab === 'paste' ? 'tab tab-active' : 'tab'}
            onClick={() => handleTabChange('paste')}
          >
            Paste PGN
          </button>
          <button
            type="button"
            role="tab"
            className={importTab === 'archive' ? 'tab tab-active' : 'tab'}
            onClick={() => handleTabChange('archive')}
          >
            Download PGN
          </button>
          <button
            type="button"
            role="tab"
            className={importTab === 'lichess' ? 'tab tab-active' : 'tab'}
            onClick={() => handleTabChange('lichess')}
          >
            Lichess
          </button>
        </div>

        {importTab === 'paste' && (
          <PgnImport onLoad={handleLoadPgn} onGamesResolved={applyResolvedGames} error={error} />
        )}
        {importTab === 'archive' && (
          <>
            <GameArchiveImport
              selectedPlayer={selectedPlayer}
              onSelectPlayer={handleSelectPlayer}
              onBackToPlayers={handleBackToPlayers}
            />
            {isLoadingGames && <p className="archive-import__status">Loading games...</p>}
            {!isLoadingGames && gamesStatus && <p className="archive-import__status">{gamesStatus}</p>}
          </>
        )}
        {importTab === 'lichess' && <LichessImport onGamesResolved={applyResolvedGames} />}
      </div>

      <div style={{ display: currentStep === 2 ? undefined : 'none' }}>
        {selectedPlayer && playerGames.length > 1 && (
          <div className="source-grid">
            <GamesTable games={playerGames} selectedPlayer={selectedPlayer} onSelectGame={handleLoadPgn} />
          </div>
        )}
      </div>

      <div style={{ display: currentStep === 3 ? undefined : 'none' }}>
        <div className="app__board-panel layout-card">
          <div className="app__board-row">
            <EvalBar
              scoreCp={line?.scoreCp ?? null}
              scoreMate={line?.scoreMate ?? null}
              sideToMove={sideToMove}
              depth={line?.depth ?? null}
              trackHeight={boardSize}
            />
            <div className="app__board">
              {gameInfo && (
                <p className="app__game-info">
                  {gameInfo.white} vs {gameInfo.black}
                  {gameInfo.year !== null && ` (${gameInfo.year})`}
                </p>
              )}
              <Board fen={currentFen} onMove={makeMove} arrows={arrows} size={boardSize} />
              <div className="app__nav">
                <button type="button" className="btn btn-sm flex-1" onClick={goFirst} disabled={isBranching}>{'|<'}</button>
                <button type="button" className="btn btn-sm flex-1" onClick={goPrev}>{'<'}</button>
                <button type="button" className="btn btn-sm flex-1" onClick={goNext} disabled={isBranching}>{'>'}</button>
                <button type="button" className="btn btn-sm flex-1" onClick={goLast} disabled={isBranching}>{'>|'}</button>
              </div>
              {isBranching && (
                <div className="app__branch-banner">
                  <span>
                    Exploring a different line{branchMoves.length > 0 && `: ${branchMoves.map((m) => m.san).join(' ')}`}
                  </span>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={returnToMainline}>
                    ← back to game
                  </button>
                </div>
              )}
              {lastMoveSan && previousFen && (
                <MoveAnalysis
                  key={`${previousFen}|${currentFen}`}
                  fenBefore={previousFen}
                  fenAfter={currentFen}
                  moveSan={lastMoveSan}
                  moverColor={previousFen.split(' ')[1] === 'b' ? 'b' : 'w'}
                />
              )}
            </div>
          </div>
          <div className="app__movelist-column">
            {moves.length > 0 && (
              <div className="app__analysis-controls">
                {!gameAnalysis.isAnalyzing && (
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => gameAnalysis.analyze(fens)}>
                    Analyze game
                  </button>
                )}
                {gameAnalysis.isAnalyzing && (
                  <>
                    <span>Analyzing... {Math.round(gameAnalysis.progress * 100)}%</span>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={gameAnalysis.cancel}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}

            <MoveList
              moves={moves}
              currentPly={currentPly}
              onSelectPly={goToPly}
              classifications={gameAnalysis.classifications}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
