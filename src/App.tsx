import { Board } from './components/Board';
import { MoveList } from './components/MoveList';
import { PgnImport } from './components/PgnImport';
import { useChessGame } from './hooks/useChessGame';
import './App.css';

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

  return (
    <div className="app">
      <h1>Chess Trainer</h1>
      <div className="app__layout">
        <div className="app__board">
          <Board fen={currentFen} onMove={makeMove} />
          <div className="app__nav">
            <button type="button" onClick={goFirst}>{'|<'}</button>
            <button type="button" onClick={goPrev}>{'<'}</button>
            <button type="button" onClick={goNext}>{'>'}</button>
            <button type="button" onClick={goLast}>{'>|'}</button>
          </div>
        </div>
        <div className="app__sidebar">
          <PgnImport onLoad={loadPgn} error={error} />
          <MoveList moves={moves} currentPly={currentPly} onSelectPly={goToPly} />
        </div>
      </div>
    </div>
  );
}

export default App;
