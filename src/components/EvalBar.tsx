type EvalBarProps = {
  scoreCp: number | null;
  scoreMate: number | null;
  sideToMove: 'w' | 'b';
  depth: number | null;
};

function toWhitePerspective(scoreCp: number | null, scoreMate: number | null, sideToMove: 'w' | 'b') {
  const sign = sideToMove === 'w' ? 1 : -1;
  return {
    cp: scoreCp === null ? null : scoreCp * sign,
    mate: scoreMate === null ? null : scoreMate * sign,
  };
}

export function EvalBar({ scoreCp, scoreMate, sideToMove, depth }: EvalBarProps) {
  const { cp, mate } = toWhitePerspective(scoreCp, scoreMate, sideToMove);

  let whitePercent = 50;
  let label = '0.0';

  if (mate !== null) {
    whitePercent = mate > 0 ? 100 : 0;
    label = `M${Math.abs(mate)}`;
  } else if (cp !== null) {
    const pawns = cp / 100;
    whitePercent = 50 + 50 * (2 / (1 + Math.exp(-0.4 * pawns)) - 1);
    label = pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
  }

  return (
    <div className="eval-bar">
      <div className="eval-bar__track">
        <div className="eval-bar__fill" style={{ height: `${whitePercent}%` }} />
      </div>
      <div className="eval-bar__info">
        <span className="eval-bar__label">{label}</span>
        {depth !== null && <span className="eval-bar__depth">depth {depth}</span>}
      </div>
    </div>
  );
}
