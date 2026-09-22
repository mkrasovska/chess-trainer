import { useEffect, useRef, useState } from 'react';
import { fetchRecentGames, searchPlayers, type LichessGame } from '../lib/lichess';

type LichessImportProps = {
  onSelectGame: (pgn: string) => void;
};

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString();
}

function resultLabel(game: LichessGame) {
  if (!game.winner) return 'Draw';
  return game.winner === 'white' ? `${game.white} won` : `${game.black} won`;
}

export function LichessImport({ onSelectGame }: LichessImportProps) {
  const [username, setUsername] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [games, setGames] = useState<LichessGame[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!username.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      searchPlayers(username).then(setSuggestions).catch(() => setSuggestions([]));
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [username]);

  const handleFetch = async (name: string) => {
    setIsLoading(true);
    setError(null);
    setGames(null);
    setSuggestions([]);
    try {
      const fetched = await fetchRecentGames(name);
      setGames(fetched);
      if (fetched.length === 0) setError(`No recent games found for "${name}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch games from Lichess.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="lichess-import">
      <p className="lichess-import__hint">Search a Lichess username, then load one of their recent games.</p>
      <div className="lichess-import__search-row">
        <input
          type="text"
          className="lichess-import__input"
          placeholder="Lichess username..."
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && username.trim()) handleFetch(username.trim());
          }}
        />
        <button
          type="button"
          className="lichess-import__button"
          disabled={isLoading || !username.trim()}
          onClick={() => handleFetch(username.trim())}
        >
          Fetch games
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="lichess-import__suggestions">
          {suggestions.map((name) => (
            <button
              type="button"
              key={name}
              className="lichess-import__suggestion"
              onClick={() => {
                setUsername(name);
                handleFetch(name);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {isLoading && <p className="lichess-import__status">Fetching games...</p>}
      {!isLoading && error && <p className="lichess-import__status lichess-import__status--error">{error}</p>}

      {games && games.length > 0 && (
        <div className="archive-import__results">
          {games.map((game) => (
            <button
              type="button"
              key={game.id}
              className="archive-import__result"
              onClick={() => onSelectGame(game.pgn)}
            >
              <span className="archive-import__players">
                {game.white} ({game.whiteRating ?? '?'}) vs {game.black} ({game.blackRating ?? '?'})
              </span>
              <span className="archive-import__meta">
                {resultLabel(game)} · {game.speed} · {game.openingName ?? 'Unknown opening'} · {formatDate(game.createdAt)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
