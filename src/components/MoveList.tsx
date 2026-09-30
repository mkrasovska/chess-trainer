import type { Move } from 'chess.js';
import { MOVE_QUALITY_SYMBOL, type MoveQuality } from '../lib/moveQuality';

type MoveListProps = {
  moves: Move[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
  classifications?: (MoveQuality | null)[];
};

export function MoveList({ moves, currentPly, onSelectPly, classifications }: MoveListProps) {
  return (
    <div className="move-list">
      {moves.length === 0 && <p className="move-list__empty">No moves yet.</p>}
      {moves.length > 0 && (
        <div className="move-list__flow">
          {moves.map((move, index) => {
            const ply = index + 1;
            const moveNumber = Math.floor(index / 2) + 1;
            const quality = classifications?.[index];
            const showSymbol = quality && quality !== 'best';
            return (
              <span className="move-list__entry" key={ply}>
                {move.color === 'w' && <span className="move-list__number">{moveNumber}.</span>}
                <button
                  type="button"
                  className={ply === currentPly ? 'move-list__move move-list__move--active' : 'move-list__move'}
                  onClick={() => onSelectPly(ply)}
                >
                  {move.san}
                  {showSymbol && (
                    <span className={`move-list__quality move-list__quality--${quality}`}>
                      {MOVE_QUALITY_SYMBOL[quality]}
                    </span>
                  )}
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
