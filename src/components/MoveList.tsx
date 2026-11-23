import { Box, Button, Typography } from '@mui/material';
import type { Move } from 'chess.js';
import { MOVE_QUALITY_SYMBOL, type MoveQuality } from '../lib/moveQuality';

const QUALITY_COLOR: Record<MoveQuality, string> = {
  blunder: 'error.main',
  mistake: 'warning.dark',
  inaccuracy: 'warning.main',
  best: 'success.main',
};

type MoveListProps = {
  moves: Move[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
  classifications?: (MoveQuality | null)[];
};

export function MoveList({ moves, currentPly, onSelectPly, classifications }: MoveListProps) {
  if (moves.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        No moves yet.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5, mt: 1 }}>
      {moves.map((move, index) => {
        const ply = index + 1;
        const moveNumber = Math.floor(index / 2) + 1;
        const quality = classifications?.[index];
        const showSymbol = quality && quality !== 'best';
        return (
          <Box key={ply} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            {move.color === 'w' && (
              <Typography variant="body2" color="text.secondary">
                {moveNumber}.
              </Typography>
            )}
            <Button
              size="small"
              variant={ply === currentPly ? 'contained' : 'text'}
              onClick={() => onSelectPly(ply)}
              sx={{ minWidth: 0, px: 1, textTransform: 'none' }}
            >
              {move.san}
              {showSymbol && (
                <Box component="span" sx={{ ml: 0.5, color: QUALITY_COLOR[quality], fontWeight: 700 }}>
                  {MOVE_QUALITY_SYMBOL[quality]}
                </Box>
              )}
            </Button>
          </Box>
        );
      })}
    </Box>
  );
}
