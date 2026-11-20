import { useState } from 'react';
import { findPlayersInGames, findSoleRecurringPlayer, MAX_PLAYERS, type PlayerMatch } from '../lib/playerMatch';
import { loadPgnGames, type PgnGame } from '../lib/pgnUtils';
import { formatSize, MAX_PASTE_BYTES } from '../lib/sourceLimits';

type PgnImportProps = {
  onLoad: (pgn: string) => void;
  // player is null when the pasted text covers more than one distinct player (or
  // none yet) -- the games are still browsable, just without filters/stats until a
  // player is actually picked (see handleSelectPlayer).
  onGamesResolved: (games: PgnGame[], player: PlayerMatch | null) => void;
  // Clears whatever an earlier paste resolved -- a fresh Load always calls this
  // first, so a new paste that DOESN'T auto-resolve to a player (unlike the one
  // before it) doesn't leave the previous paste's table/filters stuck on screen.
  onBackToPlayers: () => void;
  error: string | null;
};

export function PgnImport({ onLoad, onGamesResolved, onBackToPlayers, error }: PgnImportProps) {
  const [pgnText, setPgnText] = useState('');
  const [pastedGames, setPastedGames] = useState<PgnGame[] | null>(null);
  const [nameTerm, setNameTerm] = useState('');
  const [players, setPlayers] = useState<PlayerMatch[] | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerMatch | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);

  const handleLoad = () => {
    setPasteError(null);
    onBackToPlayers();
    const byteSize = new Blob([pgnText]).size;
    if (byteSize > MAX_PASTE_BYTES) {
      setPasteError(
        `That's ${formatSize(byteSize)} of pasted text — over the ${formatSize(MAX_PASTE_BYTES)} limit. Paste fewer games, or use the file import instead.`,
      );
      return;
    }
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

    // Expose the whole pasted pool immediately -- it's browsable as soon as it's
    // loaded, regardless of whether a player is known yet. If exactly one player
    // identity appears in every game (not a tournament dump with many distinct
    // players), resolve it right away too, same as Lichess.
    const sole = findSoleRecurringPlayer(games);
    setSelectedPlayer(sole);
    onGamesResolved(games, sole);
  };

  const handleFindPlayers = () => {
    if (!pastedGames || !nameTerm.trim()) return;
    setPlayers(findPlayersInGames(pastedGames, nameTerm, MAX_PLAYERS));
    setSelectedPlayer(null);
  };

  const handleSelectPlayer = (player: PlayerMatch) => {
    if (!pastedGames) return;
    setSelectedPlayer(player);
    onGamesResolved(pastedGames, player);
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
      {pasteError && <p className="pgn-import__error">{pasteError}</p>}

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
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                onClick={() => {
                  setSelectedPlayer(null);
                  onBackToPlayers();
                }}
              >
                ← back to players
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
