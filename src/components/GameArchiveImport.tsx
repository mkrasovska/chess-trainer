import { useEffect, useState } from 'react';
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
    <div className="archive-import layout-card">
      <p className="archive-import__hint">
        Import .pgn files -- e.g. from{' '}
        <a href="https://s2.chess-results.com/partiesuche.aspx?lan=1" target="_blank" rel="noreferrer">
          chess-results.com
        </a>{' '}
        -- they stay in your browser between visits.
      </p>

      <div className="archive-import__file-row">
        <label className="btn btn-sm archive-import__file-button">
          Choose file
          <input
            type="file"
            accept=".zip,.pgn"
            disabled={isAdding}
            className="archive-import__file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleAdd(file);
              // Reset so picking the exact same file again still fires onChange
              // (e.g. retrying after an error).
              e.target.value = '';
            }}
          />
        </label>
        <span className="archive-import__file-name">
          {library.length === 0 ? 'No file selected' : `${library.length} file${library.length === 1 ? '' : 's'} selected`}
        </span>
      </div>
      {isAdding && <p className="archive-import__status">Adding to library...</p>}
      {!isAdding && addStatus && <p className="archive-import__status">{addStatus}</p>}

      {library.length > 0 && (
        <div className="archive-import__library">
          {library.map((entry) => (
            <div className="archive-import__library-row" key={entry.id}>
              <span className="archive-import__library-name">{entry.name}</span>
              <span className="archive-import__library-size">{formatSize(entry.size)}</span>
              <button
                type="button"
                className="btn btn-xs btn-circle btn-ghost"
                onClick={() => handleRemove(entry.id)}
                aria-label={`Remove ${entry.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
