import { useMemo } from 'react';
import { usePrepLine } from '../hooks/usePrepLine';
import { getGamesMatchingMoveSequence } from '../lib/prepMatch';
import type { PlayerMatch } from '../lib/pgnStream';
import type { PgnGame } from '../lib/pgnUtils';
import { Board } from './Board';
import { GamesTable } from './GamesTable';

type PrepAgainstPlayerProps = {
  games: PgnGame[];
  selectedPlayer: PlayerMatch;
  onSelectGame: (pgn: string) => void;
};

export function PrepAgainstPlayer({ games, selectedPlayer, onSelectGame }: PrepAgainstPlayerProps) {
  const { fen, moves, makeMove, undo, reset, atMax, maxPlies } = usePrepLine();

  const moveSans = useMemo(() => moves.map((m) => m.san), [moves]);
  const matchingGames = useMemo(() => getGamesMatchingMoveSequence(games, moveSans), [games, moveSans]);

  return (
    <div className="prep-against-player">
      <p className="archive-import__hint">
        Play out a line (up to {maxPlies / 2} moves) against <strong>{selectedPlayer.name}</strong> below — the
        games and stats narrow to exactly what they played after this sequence.
      </p>
      <div className="prep-against-player__board-row">
        <div className="prep-against-player__board">
          <Board fen={fen} onMove={makeMove} id="prep-board" size={320} />
        </div>
        <div className="prep-against-player__controls">
          <div className="app__nav">
            <button type="button" onClick={undo} disabled={moves.length === 0}>
              Undo
            </button>
            <button type="button" onClick={reset} disabled={moves.length === 0}>
              Reset
            </button>
          </div>
          <p className="archive-import__status">
            {moves.length}/{maxPlies} plies{atMax ? ' (max reached)' : ''}
          </p>
          <p className="prep-against-player__line">{moveSans.length > 0 ? moveSans.join(' ') : '(no moves yet)'}</p>
          <p className="games-table__filters-count">
            {moveSans.length === 0
              ? `Showing all ${games.length} games`
              : `${matchingGames.length} of ${games.length} games match this line`}
          </p>
        </div>
      </div>

      <GamesTable games={matchingGames} selectedPlayer={selectedPlayer} onSelectGame={onSelectGame} />
    </div>
  );
}
