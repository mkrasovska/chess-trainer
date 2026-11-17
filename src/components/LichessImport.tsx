import { useEffect, useRef, useState } from 'react';
import { fetchRecentGames, searchPlayers, type LichessGame } from '../lib/lichess';
import { parsePgnHeaders, type PgnGame } from '../lib/pgnUtils';
import type { PlayerMatch } from '../lib/playerMatch';
import { GamesTable } from './GamesTable';

type LichessImportProps = {
  onSelectGame: (pgn: string) => void;
};

// Lichess PGN headers use the account's canonical display name, which may differ
// in case from whatever the user typed; GamesTable matches names exactly, so pull
// the canonical spelling from the games we actually fetched.
function resolveCanonicalName(games: LichessGame[], typed: string): string {
  const lower = typed.toLowerCase();
  for (const game of games) {
    if (game.white.toLowerCase() === lower) return game.white;
    if (game.black.toLowerCase() === lower) return game.black;
  }
  return typed;
}

export function LichessImport({ onSelectGame }: LichessImportProps) {
  const [username, setUsername] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [games, setGames] = useState<PgnGame[] | null>(null);
  const [player, setPlayer] = useState<PlayerMatch | null>(null);
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
    setPlayer(null);
    setSuggestions([]);
    try {
      const fetched = await fetchRecentGames(name);
      if (fetched.length === 0) {
        setError(`No recent games found for "${name}".`);
        return;
      }
      setGames(fetched.map((game) => ({ raw: game.pgn, headers: parsePgnHeaders(game.pgn) })));
      setPlayer({ name: resolveCanonicalName(fetched, name), fideId: null, gameCount: fetched.length });
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

      {games && player && <GamesTable games={games} selectedPlayer={player} onSelectGame={onSelectGame} />}
    </div>
  );
}
