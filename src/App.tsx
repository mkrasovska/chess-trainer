import { useEffect, useMemo, useState } from 'react';
import { AiSettings } from './components/AiSettings';
import { Board } from './components/Board';
import { EvalBar } from './components/EvalBar';
import { GameArchiveImport } from './components/GameArchiveImport';
import { GamesTable } from './components/GamesTable';
import { LichessImport } from './components/LichessImport';
import { MoveAnalysis } from './components/MoveAnalysis';
import { MoveList } from './components/MoveList';
import { PgnImport } from './components/PgnImport';
import { useChessGame } from './hooks/useChessGame';
import { useGameAnalysis } from './hooks/useGameAnalysis';
import { useStockfish } from './hooks/useStockfish';
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
  };

  const [selectedPlayer, setSelectedPlayer] = useState<PlayerMatch | null>(null);
  const [playerGames, setPlayerGames] = useState<PgnGame[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState(false);
  const [gamesStatus, setGamesStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isReady) evaluate(currentFen);
  }, [isReady, currentFen, evaluate]);

  // Left/right arrow keys step through moves, same as the |< < > >| buttons.
  // Ignored while typing in a text field elsewhere on the page (filters, paste box, etc.).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goPrev, goNext]);

  const sideToMove = (currentFen.split(' ')[1] === 'b' ? 'b' : 'w') as 'w' | 'b';
  const arrows = useMemo(() => (bestMove ? [uciToArrow(bestMove)] : []), [bestMove]);

  const handleBackToPlayers = () => {
    setSelectedPlayer(null);
    setPlayerGames([]);
    setGamesStatus(null);
  };

  const handleSelectPlayer = async (player: PlayerMatch) => {
    setSelectedPlayer(player);
    setPlayerGames([]);
    setIsLoadingGames(true);
    setGamesStatus(null);
    try {
      const games = await loadLibraryGames();
      const matched = getGamesForPlayer(games, player.name, player.fideId);
      setPlayerGames(matched);
      setGamesStatus(`Found ${matched.length} game${matched.length === 1 ? '' : 's'}.`);
    } catch {
      setGamesStatus('Could not load games for this player.');
    } finally {
      setIsLoadingGames(false);
    }
  };

  return (
    <div className="app">
      <div className="app__header">
        <h1>Chess Trainer</h1>
        <AiSettings />
      </div>

      <div className="app__tabs">
        <button
          type="button"
          className={importTab === 'paste' ? 'app__tab app__tab--active' : 'app__tab'}
          onClick={() => handleTabChange('paste')}
        >
          Paste PGN
        </button>
        <button
          type="button"
          className={importTab === 'archive' ? 'app__tab app__tab--active' : 'app__tab'}
          onClick={() => handleTabChange('archive')}
        >
          Download PGN
        </button>
        <button
          type="button"
          className={importTab === 'lichess' ? 'app__tab app__tab--active' : 'app__tab'}
          onClick={() => handleTabChange('lichess')}
        >
          Lichess
        </button>
      </div>

      {importTab === 'paste' && <PgnImport onLoad={handleLoadPgn} error={error} />}
      {importTab === 'archive' && (
        <>
          <GameArchiveImport
            selectedPlayer={selectedPlayer}
            onSelectPlayer={handleSelectPlayer}
            onBackToPlayers={handleBackToPlayers}
          />
          {selectedPlayer && (
            <div className="games-table-section">
              {isLoadingGames && <p className="archive-import__status">Loading games...</p>}
              {!isLoadingGames && gamesStatus && <p className="archive-import__status">{gamesStatus}</p>}
              {!isLoadingGames && (
                <GamesTable games={playerGames} selectedPlayer={selectedPlayer} onSelectGame={handleLoadPgn} />
              )}
            </div>
          )}
        </>
      )}
      {importTab === 'lichess' && <LichessImport onSelectGame={handleLoadPgn} />}

      <div className="app__board-panel">
        <div className="app__board-row">
          <EvalBar
            scoreCp={line?.scoreCp ?? null}
            scoreMate={line?.scoreMate ?? null}
            sideToMove={sideToMove}
            depth={line?.depth ?? null}
          />
          <div className="app__board">
            {gameInfo && (
              <p className="app__game-info">
                {gameInfo.white} vs {gameInfo.black}
                {gameInfo.year !== null && ` (${gameInfo.year})`}
              </p>
            )}
            <Board fen={currentFen} onMove={makeMove} arrows={arrows} />
            <div className="app__nav">
              <button type="button" onClick={goFirst} disabled={isBranching}>{'|<'}</button>
              <button type="button" onClick={goPrev}>{'<'}</button>
              <button type="button" onClick={goNext} disabled={isBranching}>{'>'}</button>
              <button type="button" onClick={goLast} disabled={isBranching}>{'>|'}</button>
            </div>
            {isBranching && (
              <div className="app__branch-banner">
                <span>
                  Exploring a different line{branchMoves.length > 0 && `: ${branchMoves.map((m) => m.san).join(' ')}`}
                </span>
                <button type="button" onClick={returnToMainline}>
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
                <button type="button" onClick={() => gameAnalysis.analyze(fens)}>
                  Analyze game
                </button>
              )}
              {gameAnalysis.isAnalyzing && (
                <>
                  <span>Analyzing... {Math.round(gameAnalysis.progress * 100)}%</span>
                  <button type="button" onClick={gameAnalysis.cancel}>
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
  );
}

export default App;
