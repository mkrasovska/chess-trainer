import { useState } from 'react';
import { findPlayersInGames, getGamesForPlayer, MAX_PLAYERS, type PlayerMatch } from '../lib/playerMatch';
import { loadPgnGames, type PgnGame } from '../lib/pgnUtils';

type PgnImportProps = {
  onLoad: (pgn: string) => void;
  onGamesResolved: (games: PgnGame[], player: PlayerMatch) => void;
  error: string | null;
};

export function PgnImport({ onLoad, onGamesResolved, error }: PgnImportProps) {
  const [pgnText, setPgnText] = useState('');
  const [pastedGames, setPastedGames] = useState<PgnGame[] | null>(null);
  const [nameTerm, setNameTerm] = useState('');
  const [players, setPlayers] = useState<PlayerMatch[] | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerMatch | null>(null);

  const handleLoad = () => {
    const games = loadPgnGames(pgnText);
    setPlayers(null);
    setSelectedPlayer(null);
    if (games.length <= 1) {
      // Single game (or unparseable text): go straight to the analysis board, as before.
      setPastedGames(null);
      onLoad(pgnText);
      return;
    }
    setPastedGames(games);
  };

  const handleFindPlayers = () => {
    if (!pastedGames || !nameTerm.trim()) return;
    setPlayers(findPlayersInGames(pastedGames, nameTerm, MAX_PLAYERS));
    setSelectedPlayer(null);
  };

  const handleSelectPlayer = (player: PlayerMatch) => {
    if (!pastedGames) return;
    setSelectedPlayer(player);
    onGamesResolved(getGamesForPlayer(pastedGames, player.name, player.fideId), player);
  };

  return (
    <div className="pgn-import layout-card">
      <textarea
        className="textarea textarea-bordered pgn-import__textarea"
        placeholder="Paste one or more PGN games here..."
        value={pgnText}
        onChange={(e) => setPgnText(e.target.value)}
        rows={6}
      />
      <button type="button" className="btn btn-primary btn-sm pgn-import__button" onClick={handleLoad}>
        Load
      </button>
      {error && <p className="pgn-import__error">{error}</p>}

      {pastedGames && (
        <div className="pgn-import__multi">
          <p className="archive-import__status">{pastedGames.length} games pasted.</p>

          <div className="archive-import__search-row">
            <input
              type="text"
              className="input input-bordered input-sm archive-import__search"
              placeholder="Player name..."
              value={nameTerm}
              onChange={(e) => setNameTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFindPlayers();
              }}
            />
            <button type="button" className="btn btn-sm" disabled={!nameTerm.trim()} onClick={handleFindPlayers}>
              Find players
            </button>
          </div>

          {players && players.length === 0 && (
            <p className="archive-import__status">No players found matching "{nameTerm.trim()}".</p>
          )}

          {players && players.length > 0 && !selectedPlayer && (
            <div className="archive-import__results">
              {players.map((player) => (
                <button
                  type="button"
                  key={`${player.name}:${player.fideId ?? ''}`}
                  className="archive-import__result"
                  onClick={() => handleSelectPlayer(player)}
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
              <button type="button" className="btn btn-xs btn-ghost" onClick={() => setSelectedPlayer(null)}>
                ← back to players
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
