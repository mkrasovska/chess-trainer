import { Box, Button, Chip, Stack, Typography } from '@mui/material';
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
}: PatternFilterProps) {
  // nextMoveOptions partitions the games still matching the pattern by their next
  // move, so summing their counts gives exactly how many games that is -- no need
  // for a separate "matching games" prop.
  const matchingGames = nextMoveOptions.reduce((sum, option) => sum + option.count, 0);
  const onlyOneGameLeft = nextMoveOptions.length > 0 && matchingGames <= 1;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Filter by game patterns
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
        <Box sx={{ flexShrink: 0 }}>
          <Board fen={fen} onMove={onMove} id="pattern-filter-board" size={280} />
        </Box>
        <Box sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
            {moves.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                (no moves selected yet)
              </Typography>
            ) : (
              moves.map((move, i) => (
                <Chip
                  key={i}
                  size="small"
                  variant="outlined"
                  label={`${i % 2 === 0 ? `${i / 2 + 1}. ` : ''}${move.san}`}
                  onClick={() => onTruncate(i + 1)}
                  title="Go back to right after this move"
                  sx={{ fontFamily: 'monospace' }}
                />
              ))
            )}
          </Box>
          <Stack spacing={0.75}>
            <Button variant="outlined" size="small" fullWidth onClick={onUndo} disabled={moves.length === 0}>
              Undo
            </Button>
            <Button variant="outlined" size="small" fullWidth onClick={onReset} disabled={moves.length === 0}>
              Reset
            </Button>
          </Stack>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {nextMoveOptions.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No games continue past this point.
              </Typography>
            ) : onlyOneGameLeft ? (
              <Typography variant="body2" color="text.secondary">
                Only 1 matching game left
              </Typography>
            ) : (
              nextMoveOptions.map((option) => (
                <Chip
                  key={option.name}
                  size="small"
                  color="primary"
                  variant="outlined"
                  clickable
                  label={`${option.name} (${option.count})`}
                  onClick={() => onPickMove(option.name)}
                />
              ))
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
