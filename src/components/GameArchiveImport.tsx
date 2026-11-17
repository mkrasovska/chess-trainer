import { useEffect, useState } from 'react';
import { extractPgnFromFile, IN_MEMORY_LIMIT_BYTES } from '../lib/archiveFile';
import { addArchiveToLibrary, listLibrary, loadLibraryGames, removeFromLibrary, type LibraryEntry } from '../lib/gameLibrary';
import { findPlayersInGames, MAX_PLAYERS, type PlayerMatch } from '../lib/playerMatch';

type GameArchiveImportProps = {
  selectedPlayer: PlayerMatch | null;
  onSelectPlayer: (player: PlayerMatch) => void;
  onBackToPlayers: () => void;
};

function formatSize(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1024 ** 2;
  if (mb >= 1) return `${Math.round(mb)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function GameArchiveImport({ selectedPlayer, onSelectPlayer, onBackToPlayers }: GameArchiveImportProps) {
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [addStatus, setAddStatus] = useState<string | null>(null);

  const [nameTerm, setNameTerm] = useState('');
  const [players, setPlayers] = useState<PlayerMatch[] | null>(null);
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);
  const [playerSearchStatus, setPlayerSearchStatus] = useState<string | null>(null);

  const refreshLibrary = () => listLibrary().then(setLibrary);

  useEffect(() => {
    refreshLibrary();
  }, []);

  // Previous "Find players" results (and the search term that produced them)
  // describe the library's old contents, so they go stale the moment a file
  // is added or removed.
  const clearPlayerSearch = () => {
    setNameTerm('');
    setPlayers(null);
    setPlayerSearchStatus(null);
    onBackToPlayers();
  };

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
      await refreshLibrary();
      clearPlayerSearch();
    } catch {
      setAddStatus('Could not read this file. Expected a .zip or .pgn file.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    await removeFromLibrary(id);
    await refreshLibrary();
    clearPlayerSearch();
  };

  const handleFindPlayers = async () => {
    if (!nameTerm.trim() || library.length === 0) return;
    onBackToPlayers();
    setIsSearchingPlayers(true);
    setPlayers(null);
    setPlayerSearchStatus(null);
    try {
      const games = await loadLibraryGames();
      const found = findPlayersInGames(games, nameTerm, MAX_PLAYERS);
      setPlayers(found);
      if (found.length === 0) {
        setPlayerSearchStatus(`No players found matching "${nameTerm.trim()}".`);
      } else if (found.length >= MAX_PLAYERS) {
        setPlayerSearchStatus(`Stopped at the first ${MAX_PLAYERS} players — refine the name for fewer.`);
      } else {
        setPlayerSearchStatus(`Found ${found.length} player${found.length === 1 ? '' : 's'}.`);
      }
    } catch {
      setPlayerSearchStatus('Could not search the library.');
    } finally {
      setIsSearchingPlayers(false);
    }
  };

  return (
    <div className="archive-import">
      <p className="archive-import__hint">
        Build a local game database from{' '}
        <a href="https://theweekinchess.com/twic" target="_blank" rel="noreferrer">
          The Week in Chess
        </a>
        , from{' '}
        <a href="https://s2.chess-results.com/partiesuche.aspx?lan=1" target="_blank" rel="noreferrer">
          chess-results.com
        </a>{' '}
        (search a player, check "Download PGN"), or any .pgn database — added files stay in your browser between
        visits.
      </p>

      <div className="archive-import__file-row">
        <label className="archive-import__file-button">
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
            placeholder="Player name..."
            value={nameTerm}
            disabled={isSearchingPlayers}
            onChange={(e) => setNameTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFindPlayers();
            }}
          />
          <button type="button" disabled={isSearchingPlayers || !nameTerm.trim()} onClick={handleFindPlayers}>
            Find players
          </button>
        </div>
      )}

      {isSearchingPlayers && <p className="archive-import__status">Searching...</p>}
      {!isSearchingPlayers && playerSearchStatus && <p className="archive-import__status">{playerSearchStatus}</p>}

      {players && players.length > 0 && !selectedPlayer && (
        <div className="archive-import__results">
          {players.map((player) => (
            <button
              type="button"
              key={`${player.name}:${player.fideId ?? ''}`}
              className="archive-import__result"
              onClick={() => onSelectPlayer(player)}
            >
              <span className="archive-import__players">{player.name}</span>
              <span className="archive-import__meta">
                {player.fideId ? `FIDE ${player.fideId} · ` : 'no FIDE ID · '}
                {player.gameCount} game{player.gameCount === 1 ? '' : 's'}
              </span>
            </button>
          ))}
        </div>
      )}

      {selectedPlayer && (
        <div className="archive-import__selected-player">
          <span>
            {selectedPlayer.name}
            {selectedPlayer.fideId ? ` (FIDE ${selectedPlayer.fideId})` : ''}
          </span>
          <button type="button" onClick={onBackToPlayers}>
            ← back to players
          </button>
        </div>
      )}
    </div>
  );
}
