import type { Move } from 'chess.js';

type MoveListProps = {
  moves: Move[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
};

type MoveRow = {
  moveNumber: number;
  white?: { san: string; ply: number };
  black?: { san: string; ply: number };
};

function groupByMoveNumber(moves: Move[]): MoveRow[] {
  const rows: MoveRow[] = [];
  moves.forEach((move, index) => {
    const ply = index + 1;
    if (move.color === 'w') {
      rows.push({ moveNumber: rows.length + 1, white: { san: move.san, ply } });
    } else {
      rows[rows.length - 1].black = { san: move.san, ply };
    }
  });
  return rows;
}

export function MoveList({ moves, currentPly, onSelectPly }: MoveListProps) {
  const rows = groupByMoveNumber(moves);

  return (
    <div className="move-list">
      {rows.length === 0 && <p className="move-list__empty">No moves yet.</p>}
      {rows.map((row) => (
        <div className="move-list__row" key={row.moveNumber}>
          <span className="move-list__number">{row.moveNumber}.</span>
          {row.white && (
            <button
              type="button"
              className={row.white.ply === currentPly ? 'move-list__move move-list__move--active' : 'move-list__move'}
              onClick={() => onSelectPly(row.white!.ply)}
            >
              {row.white.san}
            </button>
          )}
          {row.black && (
            <button
              type="button"
              className={row.black.ply === currentPly ? 'move-list__move move-list__move--active' : 'move-list__move'}
              onClick={() => onSelectPly(row.black!.ply)}
            >
              {row.black.san}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
