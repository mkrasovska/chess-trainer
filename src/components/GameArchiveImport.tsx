import { useEffect, useMemo, useRef, useState } from 'react';
import { extractPgnFromFile, IN_MEMORY_LIMIT_BYTES } from '../lib/archiveFile';
import { addArchiveToLibrary, getLibraryBlobs, listLibrary, removeFromLibrary, type LibraryEntry } from '../lib/gameLibrary';
import { scanLibrary } from '../lib/pgnStream';
import { type PgnGame } from '../lib/pgnUtils';

type GameArchiveImportProps = {
  onSelectGame: (pgn: string) => void;
};

const MAX_RESULTS = 200;

function formatSize(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

export function GameArchiveImport({ onSelectGame }: GameArchiveImportProps) {
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [addStatus, setAddStatus] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [games, setGames] = useState<PgnGame[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const cancelRef = useRef(false);

  const refreshLibrary = () => listLibrary().then(setLibrary);

  useEffect(() => {
    refreshLibrary();
  }, []);

  const totalSize = useMemo(() => library.reduce((sum, entry) => sum + entry.size, 0), [library]);

  const handleAdd = async (file: File) => {
    setIsAdding(true);
    setAddStatus(null);
    try {
      if (file.name.toLowerCase().endsWith('.zip')) {
        if (file.size > IN_MEMORY_LIMIT_BYTES) {
          setAddStatus(`This archive is ${formatSize(file.size)} — too large to unzip in the browser. Extract the .pgn first, then add that.`);
          return;
        }
        const pgnText = await extractPgnFromFile(file);
        await addArchiveToLibrary(file.name.replace(/\.zip$/i, '.pgn'), new Blob([pgnText], { type: 'text/plain' }));
      } else {
        await addArchiveToLibrary(file.name, file);
      }
      setAddStatus(`Added ${file.name} (${formatSize(file.size)}) to the library.`);
      await refreshLibrary();
    } catch {
      setAddStatus('Could not read this file. Expected a .zip or .pgn file.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    await removeFromLibrary(id);
    await refreshLibrary();
  };

  const handleSearch = async () => {
    if (!search.trim() || library.length === 0) return;
    cancelRef.current = false;
    setIsSearching(true);
    setGames([]);
    setProgress(0);
    setSearchStatus(null);
    try {
      const sources = await getLibraryBlobs();
      const result = await scanLibrary(sources, {
        term: search,
        maxResults: MAX_RESULTS,
        onProgress: (bytesRead) => setProgress(totalSize > 0 ? bytesRead / totalSize : 0),
        shouldStop: () => cancelRef.current,
      });
      setGames(result.games);
      if (result.cancelled) {
        setSearchStatus(`Search cancelled — ${result.games.length} games found so far.`);
      } else if (result.hitLimit) {
        setSearchStatus(`Stopped at the first ${MAX_RESULTS} matches — refine the name for fewer.`);
      } else {
        setSearchStatus(`Found ${result.games.length} games for "${search.trim()}".`);
      }
    } catch {
      setSearchStatus('Could not search the library.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="archive-import">
      <p className="archive-import__hint">
        Build a local game database from{' '}
        <a href="https://theweekinchess.com/twic" target="_blank" rel="noreferrer">
          The Week in Chess
        </a>{' '}
        issues, or any .pgn database — added files stay in your browser between visits.
      </p>

      <input
        type="file"
        accept=".zip,.pgn"
        disabled={isAdding}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleAdd(file);
          e.target.value = '';
        }}
      />
      {isAdding && <p className="archive-import__status">Adding to library...</p>}
      {!isAdding && addStatus && <p className="archive-import__status">{addStatus}</p>}

      {library.length > 0 && (
        <div className="archive-import__library">
          <p className="archive-import__library-total">
            {library.length} file{library.length === 1 ? '' : 's'} · {formatSize(totalSize)} total
          </p>
          {library.map((entry) => (
            <div className="archive-import__library-row" key={entry.id}>
              <span className="archive-import__library-name">{entry.name}</span>
              <span className="archive-import__library-size">{formatSize(entry.size)}</span>
              <button type="button" onClick={() => handleRemove(entry.id)} aria-label={`Remove ${entry.name}`}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {library.length > 0 && (
        <div className="archive-import__search-row">
          <input
            type="text"
            className="archive-import__search"
            placeholder="Search library by player name..."
            value={search}
            disabled={isSearching}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
          />
          {!isSearching && (
            <button type="button" disabled={!search.trim()} onClick={handleSearch}>
              Search
            </button>
          )}
          {isSearching && (
            <button type="button" onClick={() => { cancelRef.current = true; }}>
              Cancel
            </button>
          )}
        </div>
      )}

      {isSearching && <p className="archive-import__status">Scanning... {Math.round(progress * 100)}%</p>}
      {!isSearching && searchStatus && <p className="archive-import__status">{searchStatus}</p>}

      {games.length > 0 && (
        <div className="archive-import__results">
          {games.map((game, index) => (
            <button
              type="button"
              key={index}
              className="archive-import__result"
              onClick={() => onSelectGame(game.raw)}
            >
              <span className="archive-import__players">
                {game.headers.White ?? '?'} vs {game.headers.Black ?? '?'}
              </span>
              <span className="archive-import__meta">
                {game.headers.Event ?? ''} {game.headers.Result ?? ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
