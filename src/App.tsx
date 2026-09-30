import { useEffect, useMemo, useRef, useState } from 'react';
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
import { getLibraryBlobs } from './lib/gameLibrary';
import { scanGamesForPlayer, type PlayerMatch } from './lib/pgnStream';
import type { PgnGame } from './lib/pgnUtils';
import './App.css';

type ImportTab = 'paste' | 'archive' | 'lichess';
const MAX_GAMES = 200;

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
  } = useChessGame();

  const { isReady, line, bestMove, evaluate } = useStockfish();
  const gameAnalysis = useGameAnalysis();
  const [importTab, setImportTab] = useState<ImportTab>('paste');

  const handleLoadPgn = (pgn: string) => {
    gameAnalysis.clear();
    loadPgn(pgn);
  };

  const [selectedPlayer, setSelectedPlayer] = useState<PlayerMatch | null>(null);
  const [playerGames, setPlayerGames] = useState<PgnGame[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState(false);
  const [gamesStatus, setGamesStatus] = useState<string | null>(null);
  const [gamesProgress, setGamesProgress] = useState(0);
  const cancelGamesRef = useRef(false);

  useEffect(() => {
    if (isReady) evaluate(currentFen);
  }, [isReady, currentFen, evaluate]);

  const sideToMove = (currentFen.split(' ')[1] === 'b' ? 'b' : 'w') as 'w' | 'b';
  const arrows = useMemo(() => (bestMove ? [uciToArrow(bestMove)] : []), [bestMove]);

  const handleBackToPlayers = () => {
    setSelectedPlayer(null);
    setPlayerGames([]);
    setGamesStatus(null);
  };

  const handleSelectPlayer = async (player: PlayerMatch) => {
    cancelGamesRef.current = false;
    setSelectedPlayer(player);
    setPlayerGames([]);
    setIsLoadingGames(true);
    setGamesProgress(0);
    setGamesStatus(null);
    try {
      const sources = await getLibraryBlobs();
      const totalSize = sources.reduce((sum, source) => sum + source.blob.size, 0);
      const result = await scanGamesForPlayer(sources, {
        name: player.name,
        fideId: player.fideId,
        maxResults: MAX_GAMES,
        onProgress: (bytesRead) => setGamesProgress(totalSize > 0 ? bytesRead / totalSize : 0),
        shouldStop: () => cancelGamesRef.current,
      });
      setPlayerGames(result.games);
      if (result.cancelled) {
        setGamesStatus(`Search cancelled — ${result.games.length} games found so far.`);
      } else if (result.hitLimit) {
        setGamesStatus(`Stopped at the first ${MAX_GAMES} games.`);
      } else {
        setGamesStatus(`Found ${result.games.length} game${result.games.length === 1 ? '' : 's'}.`);
      }
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
      <div className="app__layout">
        <div className="app__board-row">
          <EvalBar
            scoreCp={line?.scoreCp ?? null}
            scoreMate={line?.scoreMate ?? null}
            sideToMove={sideToMove}
            depth={line?.depth ?? null}
          />
          <div className="app__board">
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
        <div className="app__sidebar">
          <div className="app__tabs">
            <button
              type="button"
              className={importTab === 'paste' ? 'app__tab app__tab--active' : 'app__tab'}
              onClick={() => setImportTab('paste')}
            >
              Paste PGN
            </button>
            <button
              type="button"
              className={importTab === 'archive' ? 'app__tab app__tab--active' : 'app__tab'}
              onClick={() => setImportTab('archive')}
            >
              TWIC archive
            </button>
            <button
              type="button"
              className={importTab === 'lichess' ? 'app__tab app__tab--active' : 'app__tab'}
              onClick={() => setImportTab('lichess')}
            >
              Lichess
            </button>
          </div>
          {importTab === 'paste' && <PgnImport onLoad={handleLoadPgn} error={error} />}
          {importTab === 'archive' && (
            <GameArchiveImport
              selectedPlayer={selectedPlayer}
              onSelectPlayer={handleSelectPlayer}
              onBackToPlayers={handleBackToPlayers}
            />
          )}
          {importTab === 'lichess' && <LichessImport onSelectGame={handleLoadPgn} />}

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

      {importTab === 'archive' && selectedPlayer && (
        <div className="games-table-section">
          {isLoadingGames && (
            <p className="archive-import__status">
              Loading games... {Math.round(gamesProgress * 100)}%{' '}
              <button type="button" onClick={() => { cancelGamesRef.current = true; }}>
                Cancel
              </button>
            </p>
          )}
          {!isLoadingGames && gamesStatus && <p className="archive-import__status">{gamesStatus}</p>}
          {playerGames.length > 0 && (
            <GamesTable games={playerGames} onSelectGame={handleLoadPgn} selectedPlayer={selectedPlayer} />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
