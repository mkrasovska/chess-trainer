import { useMemo, useState } from 'react';
import type { PlayerMatch } from '../lib/pgnStream';
import type { PgnGame } from '../lib/pgnUtils';

type GamesTableProps = {
  games: PgnGame[];
  onSelectGame: (pgn: string) => void;
  selectedPlayer: PlayerMatch;
};

type Color = 'white' | 'black';
type Outcome = 'win' | 'loss' | 'draw' | 'unknown';
type ColorFilter = 'all' | Color;
type OutcomeFilter = 'all' | Exclude<Outcome, 'unknown'>;

function getYear(headers: Record<string, string>): string {
  const date = headers.Date ?? headers.EventDate ?? '';
  const year = date.split('.')[0];
  return year && !year.includes('?') ? year : '?';
}

function isSelectedSide(headers: Record<string, string>, side: 'White' | 'Black', player: PlayerMatch): boolean {
  if (headers[side] !== player.name) return false;
  return (headers[`${side}FideId`] ?? null) === player.fideId;
}

function getColor(headers: Record<string, string>, player: PlayerMatch): Color | null {
  if (isSelectedSide(headers, 'White', player)) return 'white';
  if (isSelectedSide(headers, 'Black', player)) return 'black';
  return null;
}

function getOutcome(headers: Record<string, string>, color: Color | null): Outcome {
  if (!color) return 'unknown';
  const result = headers.Result;
  if (result === '1/2-1/2') return 'draw';
  if (result === '1-0') return color === 'white' ? 'win' : 'loss';
  if (result === '0-1') return color === 'black' ? 'win' : 'loss';
  return 'unknown';
}

export function GamesTable({ games, onSelectGame, selectedPlayer }: GamesTableProps) {
  const [colorFilter, setColorFilter] = useState<ColorFilter>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');

  const rows = useMemo(
    () =>
      games.map((game) => {
        const color = getColor(game.headers, selectedPlayer);
        return { game, color, outcome: getOutcome(game.headers, color) };
      }),
    [games, selectedPlayer],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (colorFilter === 'all' || row.color === colorFilter) &&
          (outcomeFilter === 'all' || row.outcome === outcomeFilter),
      ),
    [rows, colorFilter, outcomeFilter],
  );

  return (
    <div>
      <div className="games-table__filters">
        <label>
          Color:{' '}
          <select value={colorFilter} onChange={(e) => setColorFilter(e.target.value as ColorFilter)}>
            <option value="all">All</option>
            <option value="white">White</option>
            <option value="black">Black</option>
          </select>
        </label>
        <label>
          Result:{' '}
          <select value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value as OutcomeFilter)}>
            <option value="all">All</option>
            <option value="win">Wins</option>
            <option value="loss">Losses</option>
            <option value="draw">Draws</option>
          </select>
        </label>
        <span className="games-table__filters-count">
          Showing {filteredRows.length} of {games.length} games
        </span>
      </div>

      <div className="games-table-wrap">
        <table className="games-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>White</th>
              <th>Elo</th>
              <th>Black</th>
              <th>Elo</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(({ game, color }, index) => (
              <tr key={index} className="games-table__row" onClick={() => onSelectGame(game.raw)}>
                <td>{getYear(game.headers)}</td>
                <td className={color === 'white' ? 'games-table__player--selected' : undefined}>
                  {game.headers.White ?? '?'}
                </td>
                <td>{game.headers.WhiteElo ?? '—'}</td>
                <td className={color === 'black' ? 'games-table__player--selected' : undefined}>
                  {game.headers.Black ?? '?'}
                </td>
                <td>{game.headers.BlackElo ?? '—'}</td>
                <td>{game.headers.Result ?? '?'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
