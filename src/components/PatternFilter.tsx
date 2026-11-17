import type { Move } from 'chess.js';
import type { OpeningStat } from '../lib/gameStats';
import { Board } from './Board';

type PatternFilterProps = {
  fen: string;
  moves: Move[];
  nextMoveOptions: OpeningStat[];
  onMove: (from: string, to: string, promotion?: string) => boolean;
  onPickMove: (san: string) => void;
  onTruncate: (ply: number) => void;
  onUndo: () => void;
  onReset: () => void;
  atMax: boolean;
  maxPlies: number;
};

export function PatternFilter({
  fen,
  moves,
  nextMoveOptions,
  onMove,
  onPickMove,
  onTruncate,
  onUndo,
  onReset,
  atMax,
  maxPlies,
}: PatternFilterProps) {
  return (
    <div className="pattern-filter">
      <span className="games-table__filter-label">Filter by game patterns</span>
      <div className="pattern-filter__row">
        <div className="pattern-filter__board">
          <Board fen={fen} onMove={onMove} id="pattern-filter-board" size={280} />
        </div>
        <div className="pattern-filter__side">
          <div className="pattern-filter__picked">
            {moves.length === 0 ? (
              <span className="pattern-filter__picked-empty">(no moves selected yet)</span>
            ) : (
              moves.map((move, i) => (
                <button
                  key={i}
                  type="button"
                  className="pattern-filter__picked-move"
                  onClick={() => onTruncate(i + 1)}
                  title="Go back to right after this move"
                >
                  {i % 2 === 0 ? `${i / 2 + 1}.` : ''}
                  {move.san}
                </button>
              ))
            )}
          </div>
          <div className="app__nav">
            <button type="button" onClick={onUndo} disabled={moves.length === 0}>
              Undo
            </button>
            <button type="button" onClick={onReset} disabled={moves.length === 0}>
              Reset
            </button>
          </div>
          <p className="archive-import__status">
            {moves.length}/{maxPlies} plies{atMax ? ' (max reached)' : ''}
          </p>
          {!atMax && (
            <div className="pattern-filter__options">
              {nextMoveOptions.length === 0 ? (
                <span className="pattern-filter__no-options">No games continue past this point.</span>
              ) : (
                nextMoveOptions.map((option) => (
                  <button
                    key={option.name}
                    type="button"
                    className="pattern-filter__option"
                    onClick={() => onPickMove(option.name)}
                  >
                    {option.name} ({option.count})
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
