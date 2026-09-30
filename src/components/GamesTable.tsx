import type { PlayerMatch } from '../lib/pgnStream';
import type { PgnGame } from '../lib/pgnUtils';

type GamesTableProps = {
  games: PgnGame[];
  onSelectGame: (pgn: string) => void;
  selectedPlayer: PlayerMatch;
};

function getYear(headers: Record<string, string>): string {
  const date = headers.Date ?? headers.EventDate ?? '';
  const year = date.split('.')[0];
  return year && !year.includes('?') ? year : '?';
}

function isSelectedSide(headers: Record<string, string>, side: 'White' | 'Black', player: PlayerMatch): boolean {
  if (headers[side] !== player.name) return false;
  return (headers[`${side}FideId`] ?? null) === player.fideId;
}

export function GamesTable({ games, onSelectGame, selectedPlayer }: GamesTableProps) {
  return (
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
          {games.map((game, index) => {
            const whiteSelected = isSelectedSide(game.headers, 'White', selectedPlayer);
            const blackSelected = isSelectedSide(game.headers, 'Black', selectedPlayer);
            return (
              <tr key={index} className="games-table__row" onClick={() => onSelectGame(game.raw)}>
                <td>{getYear(game.headers)}</td>
                <td className={whiteSelected ? 'games-table__player--selected' : undefined}>
                  {game.headers.White ?? '?'}
                </td>
                <td>{game.headers.WhiteElo ?? '—'}</td>
                <td className={blackSelected ? 'games-table__player--selected' : undefined}>
                  {game.headers.Black ?? '?'}
                </td>
                <td>{game.headers.BlackElo ?? '—'}</td>
                <td>{game.headers.Result ?? '?'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
