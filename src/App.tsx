import { useEffect, useMemo, useState } from 'react';
import { Board } from './components/Board';
import { EvalBar } from './components/EvalBar';
import { GameArchiveImport } from './components/GameArchiveImport';
import { MoveList } from './components/MoveList';
import { PgnImport } from './components/PgnImport';
import { useChessGame } from './hooks/useChessGame';
import { useStockfish } from './hooks/useStockfish';
import './App.css';

type ImportTab = 'paste' | 'archive';

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
    currentPly,
    currentFen,
    error,
    loadPgn,
    makeMove,
    goToPly,
    goFirst,
    goPrev,
    goNext,
    goLast,
  } = useChessGame();

  const { isReady, line, bestMove, evaluate } = useStockfish();
  const [importTab, setImportTab] = useState<ImportTab>('paste');

  useEffect(() => {
    if (isReady) evaluate(currentFen);
  }, [isReady, currentFen, evaluate]);

  const sideToMove = (currentFen.split(' ')[1] === 'b' ? 'b' : 'w') as 'w' | 'b';
  const arrows = useMemo(() => (bestMove ? [uciToArrow(bestMove)] : []), [bestMove]);

  return (
    <div className="app">
      <h1>Chess Trainer</h1>
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
              <button type="button" onClick={goFirst}>{'|<'}</button>
              <button type="button" onClick={goPrev}>{'<'}</button>
              <button type="button" onClick={goNext}>{'>'}</button>
              <button type="button" onClick={goLast}>{'>|'}</button>
            </div>
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
          </div>
          {importTab === 'paste' ? (
            <PgnImport onLoad={loadPgn} error={error} />
          ) : (
            <GameArchiveImport onSelectGame={loadPgn} />
          )}
          <MoveList moves={moves} currentPly={currentPly} onSelectPly={goToPly} />
        </div>
      </div>
    </div>
  );
}

export default App;
