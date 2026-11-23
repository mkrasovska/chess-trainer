import { useState } from 'react';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';
import { loadPgnGames, type PgnGame } from '../lib/pgnUtils';
import { formatSize, MAX_PASTE_BYTES } from '../lib/sourceLimits';

type PgnImportProps = {
  onLoad: (pgn: string) => void;
  // Exposes the pasted pool upward -- whose perspective to view it from (if any) is
  // picked later, as a filter in the games table itself.
  onGamesResolved: (games: PgnGame[]) => void;
  error: string | null;
};

export function PgnImport({ onLoad, onGamesResolved, error }: PgnImportProps) {
  const [pgnText, setPgnText] = useState('');
  const [pastedCount, setPastedCount] = useState<number | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);

  const handleLoad = () => {
    setPasteError(null);
    const byteSize = new Blob([pgnText]).size;
    if (byteSize > MAX_PASTE_BYTES) {
      setPasteError(
        `That's ${formatSize(byteSize)} of pasted text — over the ${formatSize(MAX_PASTE_BYTES)} limit. Paste fewer games, or use the file import instead.`,
      );
      return;
    }
    const games = loadPgnGames(pgnText);
    if (games.length <= 1) {
      // Single game (or unparseable text): go straight to the analysis board, as before.
      setPastedCount(null);
      onLoad(pgnText);
      return;
    }
    setPastedCount(games.length);
    onGamesResolved(games);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TextField
        multiline
        minRows={6}
        placeholder="Paste one or more PGN games here..."
        value={pgnText}
        onChange={(e) => setPgnText(e.target.value)}
      />
      <Box>
        <Button variant="contained" size="small" onClick={handleLoad}>
          Load
        </Button>
      </Box>
      {error && <Typography color="error">{error}</Typography>}
      {pasteError && <Typography color="error">{pasteError}</Typography>}
      {pastedCount !== null && <Typography variant="body2">{pastedCount} games pasted.</Typography>}
    </Paper>
  );
}
