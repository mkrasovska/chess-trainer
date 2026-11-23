import { Box, Typography } from '@mui/material';

type EvalBarProps = {
  scoreCp: number | null;
  scoreMate: number | null;
  sideToMove: 'w' | 'b';
  depth: number | null;
  // Matches the board's actual rendered size so the bar is never taller/shorter
  // than the board it sits beside; falls back to a sensible default when omitted.
  trackHeight?: number;
};

function toWhitePerspective(scoreCp: number | null, scoreMate: number | null, sideToMove: 'w' | 'b') {
  const sign = sideToMove === 'w' ? 1 : -1;
  return {
    cp: scoreCp === null ? null : scoreCp * sign,
    mate: scoreMate === null ? null : scoreMate * sign,
  };
}

export function EvalBar({ scoreCp, scoreMate, sideToMove, depth, trackHeight }: EvalBarProps) {
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
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, width: 32 }}>
      <Box
        sx={{
          width: '100%',
          height: trackHeight ?? 480,
          bgcolor: 'grey.900',
          borderRadius: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ width: '100%', height: `${whitePercent}%`, bgcolor: 'grey.100', transition: 'height 0.2s ease' }} />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        {depth !== null && (
          <Typography variant="caption" color="text.secondary">
            depth {depth}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
