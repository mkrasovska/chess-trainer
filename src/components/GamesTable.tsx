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
type FilterableOutcome = Exclude<Outcome, 'unknown'>;
type EcoLetter = 'A' | 'B' | 'C' | 'D' | 'E';
type FirstMove = 'e4' | 'd4' | 'c4' | 'Nf3' | 'other';

const COLOR_OPTIONS: { value: Color; label: string }[] = [
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
];

const OUTCOME_OPTIONS: { value: FilterableOutcome; label: string }[] = [
  { value: 'win', label: 'Wins' },
  { value: 'loss', label: 'Losses' },
  { value: 'draw', label: 'Draws' },
];

const ECO_LABELS: Record<EcoLetter, string> = {
  A: 'Flank Openings',
  B: 'Semi-Open Games',
  C: 'Open Games',
  D: 'Closed & Queen’s Pawn',
  E: 'Indian Defenses',
};
const ECO_ORDER: EcoLetter[] = ['A', 'B', 'C', 'D', 'E'];

const FIRST_MOVE_LABELS: Record<FirstMove, string> = {
  e4: '1.e4',
  d4: '1.d4',
  c4: '1.c4',
  Nf3: '1.Nf3',
  other: 'Other',
};
const FIRST_MOVE_ORDER: FirstMove[] = ['e4', 'd4', 'c4', 'Nf3', 'other'];

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function getYear(headers: Record<string, string>): number | null {
  const date = headers.Date ?? headers.EventDate ?? '';
  const year = Number(date.split('.')[0]);
  return Number.isInteger(year) && year > 0 ? year : null;
}

function getEcoLetter(headers: Record<string, string>): EcoLetter | null {
  const letter = headers.ECO?.[0];
  return letter && (ECO_ORDER as string[]).includes(letter) ? (letter as EcoLetter) : null;
}

function getFirstMove(raw: string): FirstMove | null {
  const separatorIndex = raw.indexOf('\n\n');
  const moveText = separatorIndex === -1 ? raw : raw.slice(separatorIndex + 2);
  const match = moveText.match(/1\.\s*(\S+)/);
  if (!match) return null;
  const move = match[1].replace(/[+#!?]+$/g, '');
  if (move === 'e4' || move === 'd4' || move === 'c4' || move === 'Nf3') return move;
  return 'other';
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
  const [colorFilter, setColorFilter] = useState<Set<Color>>(new Set());
  const [outcomeFilter, setOutcomeFilter] = useState<Set<FilterableOutcome>>(new Set());
  const [ecoFilter, setEcoFilter] = useState<Set<EcoLetter>>(new Set());
  const [firstMoveFilter, setFirstMoveFilter] = useState<Set<FirstMove>>(new Set());
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');

  const rows = useMemo(
    () =>
      games.map((game) => {
        const color = getColor(game.headers, selectedPlayer);
        return {
          game,
          color,
          outcome: getOutcome(game.headers, color),
          eco: getEcoLetter(game.headers),
          firstMove: getFirstMove(game.raw),
          year: getYear(game.headers),
        };
      }),
    [games, selectedPlayer],
  );

  const availableEcoLetters = useMemo(
    () => ECO_ORDER.filter((letter) => rows.some((row) => row.eco === letter)),
    [rows],
  );

  const availableFirstMoves = useMemo(
    () => FIRST_MOVE_ORDER.filter((move) => rows.some((row) => row.firstMove === move)),
    [rows],
  );

  const yearFromNum = yearFrom.trim() ? Number(yearFrom) : null;
  const yearToNum = yearTo.trim() ? Number(yearTo) : null;

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (colorFilter.size > 0 && (row.color === null || !colorFilter.has(row.color))) return false;
        if (outcomeFilter.size > 0 && (row.outcome === 'unknown' || !outcomeFilter.has(row.outcome))) return false;
        if (ecoFilter.size > 0 && (row.eco === null || !ecoFilter.has(row.eco))) return false;
        if (firstMoveFilter.size > 0 && (row.firstMove === null || !firstMoveFilter.has(row.firstMove))) return false;
        if (yearFromNum !== null && (row.year === null || row.year < yearFromNum)) return false;
        if (yearToNum !== null && (row.year === null || row.year > yearToNum)) return false;
        return true;
      }),
    [rows, colorFilter, outcomeFilter, ecoFilter, firstMoveFilter, yearFromNum, yearToNum],
  );

  return (
    <div>
      <div className="games-table__filters">
        <span className="games-table__filter-group">
          Color:
          {COLOR_OPTIONS.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={colorFilter.has(option.value)}
                onChange={() => setColorFilter((prev) => toggle(prev, option.value))}
              />
              {option.label}
            </label>
          ))}
        </span>
        <span className="games-table__filter-group">
          Result:
          {OUTCOME_OPTIONS.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={outcomeFilter.has(option.value)}
                onChange={() => setOutcomeFilter((prev) => toggle(prev, option.value))}
              />
              {option.label}
            </label>
          ))}
        </span>
        {availableEcoLetters.length > 0 && (
          <span className="games-table__filter-group">
            Opening:
            {availableEcoLetters.map((letter) => (
              <label key={letter} title={ECO_LABELS[letter]}>
                <input
                  type="checkbox"
                  checked={ecoFilter.has(letter)}
                  onChange={() => setEcoFilter((prev) => toggle(prev, letter))}
                />
                {letter} – {ECO_LABELS[letter]}
              </label>
            ))}
          </span>
        )}
        {availableFirstMoves.length > 0 && (
          <span className="games-table__filter-group">
            First move:
            {availableFirstMoves.map((move) => (
              <label key={move}>
                <input
                  type="checkbox"
                  checked={firstMoveFilter.has(move)}
                  onChange={() => setFirstMoveFilter((prev) => toggle(prev, move))}
                />
                {FIRST_MOVE_LABELS[move]}
              </label>
            ))}
          </span>
        )}
        <span className="games-table__filter-group">
          Year:
          <input
            type="number"
            className="games-table__year-input"
            placeholder="From"
            value={yearFrom}
            onChange={(e) => setYearFrom(e.target.value)}
          />
          <span>–</span>
          <input
            type="number"
            className="games-table__year-input"
            placeholder="To"
            value={yearTo}
            onChange={(e) => setYearTo(e.target.value)}
          />
        </span>
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
            {filteredRows.map(({ game, color, year }, index) => (
              <tr key={index} className="games-table__row" onClick={() => onSelectGame(game.raw)}>
                <td>{year ?? '?'}</td>
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
