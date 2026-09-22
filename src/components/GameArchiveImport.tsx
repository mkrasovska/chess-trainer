import { useMemo, useRef, useState } from 'react';
import { extractPgnFromFile, IN_MEMORY_LIMIT_BYTES } from '../lib/archiveFile';
import { scanPgnFile } from '../lib/pgnStream';
import { loadPgnGames, type PgnGame } from '../lib/pgnUtils';

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
  const [games, setGames] = useState<PgnGame[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [largeFile, setLargeFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const cancelRef = useRef(false);

  const handleFile = async (file: File) => {
    setGames([]);
    setProgress(0);
    setSearch('');

    const isZip = file.name.toLowerCase().endsWith('.zip');
    if (file.size > IN_MEMORY_LIMIT_BYTES) {
      if (isZip) {
        setLargeFile(null);
        setStatus(`This archive is ${formatSize(file.size)} — too large to unzip in the browser. Extract the .pgn first, then load that.`);
        return;
      }
      setLargeFile(file);
      setStatus(`${file.name} (${formatSize(file.size)}) ready. Enter a player name and search — the file is scanned without loading it into memory.`);
      return;
    }

    setLargeFile(null);
    setIsLoading(true);
    setStatus(null);
    try {
      const pgnText = await extractPgnFromFile(file);
      const parsed = loadPgnGames(pgnText);
      setGames(parsed);
      setStatus(`Loaded ${parsed.length} games.`);
    } catch {
      setStatus('Could not read this file. Expected a TWIC .zip or a .pgn file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScan = async () => {
    if (!largeFile || !search.trim()) return;
    cancelRef.current = false;
    setIsLoading(true);
    setGames([]);
    setProgress(0);
    setStatus(null);
    try {
      const result = await scanPgnFile(largeFile, {
        term: search,
        maxResults: MAX_RESULTS,
        onProgress: (bytesRead) => setProgress(bytesRead / largeFile.size),
        shouldStop: () => cancelRef.current,
      });
      setGames(result.games);
      if (result.cancelled) {
        setStatus(`Search cancelled — ${result.games.length} games found so far.`);
      } else if (result.hitLimit) {
        setStatus(`Stopped at the first ${MAX_RESULTS} matches — refine the name for fewer.`);
      } else {
        setStatus(`Found ${result.games.length} games for "${search.trim()}".`);
      }
    } catch {
      setStatus('Could not read this file.');
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (largeFile) return games;
    const term = search.trim().toLowerCase();
    const matches = term
      ? games.filter((game) => {
          const white = game.headers.White?.toLowerCase() ?? '';
          const black = game.headers.Black?.toLowerCase() ?? '';
          return white.includes(term) || black.includes(term);
        })
      : games;
    return matches.slice(0, MAX_RESULTS);
  }, [games, search, largeFile]);

  return (
    <div className="archive-import">
      <p className="archive-import__hint">
        Load a .pgn database, or a games archive from{' '}
        <a href="https://theweekinchess.com/twic" target="_blank" rel="noreferrer">
          The Week in Chess
        </a>
        .
      </p>
      <input
        type="file"
        accept=".zip,.pgn"
        disabled={isLoading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      {(largeFile || games.length > 0) && (
        <div className="archive-import__search-row">
          <input
            type="text"
            className="archive-import__search"
            placeholder="Filter by player name..."
            value={search}
            disabled={isLoading}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && largeFile) handleScan();
            }}
          />
          {largeFile && !isLoading && (
            <button type="button" disabled={!search.trim()} onClick={handleScan}>
              Search
            </button>
          )}
          {largeFile && isLoading && (
            <button type="button" onClick={() => { cancelRef.current = true; }}>
              Cancel
            </button>
          )}
        </div>
      )}

      {isLoading && largeFile && (
        <p className="archive-import__status">Scanning... {Math.round(progress * 100)}%</p>
      )}
      {isLoading && !largeFile && <p className="archive-import__status">Reading archive...</p>}
      {!isLoading && status && <p className="archive-import__status">{status}</p>}

      {filtered.length > 0 && (
        <div className="archive-import__results">
          {filtered.map((game, index) => (
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
          {!largeFile && games.length > MAX_RESULTS && filtered.length === MAX_RESULTS && (
            <p className="archive-import__more-hint">Showing first {MAX_RESULTS} results — refine your search.</p>
          )}
        </div>
      )}
    </div>
  );
}
