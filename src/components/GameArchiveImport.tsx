import { useEffect, useState } from 'react';
import { Box, Button, IconButton, Link, List, ListItem, ListItemText, Paper, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { extractPgnFromFile } from '../lib/archiveFile';
import { addArchiveToLibrary, listLibrary, loadLibraryGames, removeFromLibrary, type LibraryEntry } from '../lib/gameLibrary';
import type { PgnGame } from '../lib/pgnUtils';
import { formatSize, MAX_FILE_BYTES } from '../lib/sourceLimits';

type GameArchiveImportProps = {
  // Exposes the library's whole game pool upward -- whose perspective to view it
  // from (if any) is picked later, as a filter in the games table itself.
  onGamesLoaded: (games: PgnGame[]) => void;
};

export function GameArchiveImport({ onGamesLoaded }: GameArchiveImportProps) {
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [addStatus, setAddStatus] = useState<string | null>(null);

  const refreshLibrary = () => listLibrary().then(setLibrary);

  const syncLibraryGames = async () => {
    try {
      onGamesLoaded(await loadLibraryGames());
    } catch {
      // Leaves the pool as it was; the file list/status above still shows what's there.
    }
  };

  useEffect(() => {
    refreshLibrary();
    syncLibraryGames();
    // Mount-only: re-running on every onGamesLoaded identity change would refire
    // this for no reason, since the library itself hasn't changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async (file: File) => {
    setIsAdding(true);
    setAddStatus(null);
    try {
      if (file.name.toLowerCase().endsWith('.zip')) {
        if (file.size > MAX_FILE_BYTES) {
          setAddStatus(`This archive is ${formatSize(file.size)} — over the ${formatSize(MAX_FILE_BYTES)} limit. Extract the .pgn first (it'll likely be smaller zipped), then add that.`);
          return;
        }
        const pgnText = await extractPgnFromFile(file);
        // Compression means a zip under the limit can still unpack to PGN text over
        // it -- check the actual extracted size too, not just the zip's own.
        const pgnBlob = new Blob([pgnText], { type: 'text/plain' });
        if (pgnBlob.size > MAX_FILE_BYTES) {
          setAddStatus(`This archive unpacks to ${formatSize(pgnBlob.size)} of PGN — over the ${formatSize(MAX_FILE_BYTES)} limit. Split it into smaller files first.`);
          return;
        }
        await addArchiveToLibrary(file.name.replace(/\.zip$/i, '.pgn'), pgnBlob);
      } else {
        if (file.size > MAX_FILE_BYTES) {
          setAddStatus(`This file is ${formatSize(file.size)} — over the ${formatSize(MAX_FILE_BYTES)} limit. Split it into smaller files first.`);
          return;
        }
        await addArchiveToLibrary(file.name, file);
      }
      await refreshLibrary();
      await syncLibraryGames();
    } catch {
      setAddStatus('Could not read this file. Expected a .zip or .pgn file.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    await removeFromLibrary(id);
    await refreshLibrary();
    await syncLibraryGames();
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Import .pgn files -- e.g. from{' '}
        <Link href="https://s2.chess-results.com/partiesuche.aspx?lan=1" target="_blank" rel="noreferrer">
          chess-results.com
        </Link>{' '}
        -- they stay in your browser between visits.
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Button component="label" variant="outlined" size="small" disabled={isAdding}>
          Choose file
          <input
            type="file"
            accept=".zip,.pgn"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleAdd(file);
              // Reset so picking the exact same file again still fires onChange
              // (e.g. retrying after an error).
              e.target.value = '';
            }}
          />
        </Button>
        <Typography variant="body2" color="text.secondary">
          {library.length === 0 ? 'No file selected' : `${library.length} file${library.length === 1 ? '' : 's'} selected`}
        </Typography>
      </Box>

      {isAdding && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          Adding to library...
        </Typography>
      )}
      {!isAdding && addStatus && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {addStatus}
        </Typography>
      )}

      {library.length > 0 && (
        <List dense sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mt: 2 }}>
          {library.map((entry, index) => (
            <ListItem
              key={entry.id}
              divider={index < library.length - 1}
              secondaryAction={
                <IconButton size="small" aria-label={`Remove ${entry.name}`} onClick={() => handleRemove(entry.id)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemText primary={entry.name} secondary={formatSize(entry.size)} />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}
