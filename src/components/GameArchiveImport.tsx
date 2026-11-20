import { useEffect, useState } from 'react';
import { extractPgnFromFile } from '../lib/archiveFile';
import { addArchiveToLibrary, listLibrary, loadLibraryGames, removeFromLibrary, type LibraryEntry } from '../lib/gameLibrary';
import { findPlayersInGames, MAX_PLAYERS, type PlayerMatch } from '../lib/playerMatch';
import { formatSize, MAX_FILE_BYTES } from '../lib/sourceLimits';

type GameArchiveImportProps = {
  selectedPlayer: PlayerMatch | null;
  onSelectPlayer: (player: PlayerMatch) => void;
  onBackToPlayers: () => void;
};

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

      {library.length > 0 && (
        <div className="archive-import__search-row">
          <input
            type="text"
            className="input input-bordered input-sm archive-import__search"
            placeholder="Player name..."
            value={nameTerm}
            disabled={isSearchingPlayers}
            onChange={(e) => setNameTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFindPlayers();
            }}
          />
          <button type="button" className="btn btn-sm" disabled={isSearchingPlayers || !nameTerm.trim()} onClick={handleFindPlayers}>
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
          <button type="button" className="btn btn-xs btn-ghost" onClick={onBackToPlayers}>
            ← back to players
          </button>
        </div>
      )}
    </div>
  );
}
