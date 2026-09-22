import { useMemo, useState } from 'react';
import { extractPgnFromFile } from '../lib/archiveFile';
import { loadPgnGames, type PgnGame } from '../lib/pgnUtils';

type GameArchiveImportProps = {
  onSelectGame: (pgn: string) => void;
};

const MAX_RESULTS = 200;

export function GameArchiveImport({ onSelectGame }: GameArchiveImportProps) {
  const [games, setGames] = useState<PgnGame[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFile = async (file: File) => {
    setIsLoading(true);
    setStatus(null);
    try {
      const pgnText = await extractPgnFromFile(file);
      const parsed = loadPgnGames(pgnText);
      setGames(parsed);
      setStatus(`Loaded ${parsed.length} games.`);
    } catch {
      setStatus('Could not read this file. Expected a TWIC .zip or a .pgn file.');
      setGames([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = term
      ? games.filter((game) => {
          const white = game.headers.White?.toLowerCase() ?? '';
          const black = game.headers.Black?.toLowerCase() ?? '';
          return white.includes(term) || black.includes(term);
        })
      : games;
    return matches.slice(0, MAX_RESULTS);
  }, [games, search]);

  return (
    <div className="archive-import">
      <p className="archive-import__hint">
        Download a games archive from{' '}
        <a href="https://theweekinchess.com/twic" target="_blank" rel="noreferrer">
          The Week in Chess
        </a>{' '}
        (.zip or .pgn) and load it here.
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
      {isLoading && <p className="archive-import__status">Reading archive...</p>}
      {!isLoading && status && <p className="archive-import__status">{status}</p>}

      {games.length > 0 && (
        <>
          <input
            type="text"
            className="archive-import__search"
            placeholder="Filter by player name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
            {games.length > MAX_RESULTS && filtered.length === MAX_RESULTS && (
              <p className="archive-import__more-hint">Showing first {MAX_RESULTS} results — refine your search.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
