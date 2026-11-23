import { Box, Typography } from '@mui/material';
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
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        No moves yet.
      </Typography>
    );
  }

  // justifyContent: space-between (below) stretches each wrapped line flush from the
  // left edge to the right edge -- but applied bare, it does that to the LAST
  // (possibly partial) line too, same as every other line, unlike text-align: justify
  // which always leaves a paragraph's last line alone. The standard fix: pad the item
  // list with a bunch of small, invisible, zero-height filler boxes after the real
  // moves. However many real moves land on the final visible line, those fillers fill
  // out the rest of *that same* flex line, so space-between's extra space gets spread
  // across many gaps (real + filler) instead of concentrated into a few huge gaps
  // between just the leftover real moves -- which reads as effectively left-aligned.
  // Full lines are unaffected, since they're already packed with real moves before any
  // filler is reached.
  const FILLER_COUNT = 24;
  const FILLER_WIDTH = 32;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '2px', mt: 1, width: '100%' }}>
      {moves.map((move, index) => {
        const ply = index + 1;
        const moveNumber = Math.floor(index / 2) + 1;
        const quality = classifications?.[index];
        const showSymbol = quality && quality !== 'best';
        return (
          <Box key={ply} sx={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {move.color === 'w' && (
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                {moveNumber}.
              </Typography>
            )}
            {/* A plain button, not MUI's <Button> -- that always looks like a button (padding,
                elevation); a selected move should just read as highlighted text. */}
            <Box
              component="button"
              type="button"
              onClick={() => onSelectPly(ply)}
              sx={{
                border: 0,
                borderRadius: '3px',
                bgcolor: ply === currentPly ? 'action.selected' : 'transparent',
                color: 'text.primary',
                font: 'inherit',
                fontSize: '0.8125rem',
                lineHeight: 1.4,
                cursor: 'pointer',
                px: '3px',
                py: 0,
                '&:hover': { bgcolor: ply === currentPly ? 'action.selected' : 'action.hover' },
              }}
            >
              {move.san}
              {showSymbol && (
                <Box component="span" sx={{ ml: '2px', color: QUALITY_COLOR[quality], fontWeight: 700 }}>
                  {MOVE_QUALITY_SYMBOL[quality]}
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
      {Array.from({ length: FILLER_COUNT }).map((_, i) => (
        <Box key={`filler-${i}`} aria-hidden sx={{ width: FILLER_WIDTH, height: 0 }} />
      ))}
    </Box>
  );
}
