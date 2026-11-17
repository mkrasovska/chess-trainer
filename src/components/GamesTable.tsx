import { useEffect, useMemo, useRef, useState } from 'react';
import { OpeningStats } from './OpeningStats';
import { PatternFilter } from './PatternFilter';
import { usePrepLine } from '../hooks/usePrepLine';
import { historyIfMatchesPrefix } from '../lib/prepMatch';
import { getColor, getNextMoveBreakdown, getOutcome, getYear, type Color, type Outcome } from '../lib/gameStats';
import type { PlayerMatch } from '../lib/playerMatch';
import type { PgnGame } from '../lib/pgnUtils';

type GamesTableProps = {
  games: PgnGame[];
  onSelectGame: (pgn: string) => void;
  selectedPlayer: PlayerMatch;
};

type FilterableOutcome = Exclude<Outcome, 'unknown'>;

const COLOR_OPTIONS: { value: Color; label: string }[] = [
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
];

const OUTCOME_OPTIONS: { value: FilterableOutcome; label: string }[] = [
  { value: 'win', label: 'Wins' },
  { value: 'loss', label: 'Losses' },
  { value: 'draw', label: 'Draws' },
];

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

type Row = {
  game: PgnGame;
  color: Color | null;
  outcome: Outcome;
  year: number | null;
};

type FilterGroup = 'color' | 'outcome' | 'year' | 'pattern';

export function GamesTable({ games, onSelectGame, selectedPlayer }: GamesTableProps) {
  const [colorFilter, setColorFilter] = useState<Set<Color>>(new Set());
  const [outcomeFilter, setOutcomeFilter] = useState<Set<FilterableOutcome>>(new Set());
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');

  const { fen, moves, makeMove, makeMoveSan, undo, truncateTo, reset, atMax, maxPlies } = usePrepLine();
  const moveSans = useMemo(() => moves.map((m) => m.san), [moves]);

  // With 0 or 1 games there's nothing to filter/compare, so skip the filters/stats/table
  // chrome entirely and just hand the one game straight to the analysis board.
  const onSelectGameRef = useRef(onSelectGame);
  onSelectGameRef.current = onSelectGame;
  useEffect(() => {
    if (games.length === 1) onSelectGameRef.current(games[0].raw);
  }, [games]);

  const rows = useMemo(
    () =>
      games.map((game) => {
        const color = getColor(game.headers, selectedPlayer);
        return {
          game,
          color,
          outcome: getOutcome(game.headers, color),
          year: getYear(game.headers),
        };
      }),
    [games, selectedPlayer],
  );

  const yearFromNum = yearFrom.trim() ? Number(yearFrom) : null;
  const yearToNum = yearTo.trim() ? Number(yearTo) : null;

  // Checks a row against every active filter except `exclude`, so each filter group's
  // own counters reflect every OTHER group's current selection without zeroing itself out.
  const matchesFilters = (row: Row, exclude: FilterGroup | null): boolean => {
    if (exclude !== 'color' && colorFilter.size > 0 && (row.color === null || !colorFilter.has(row.color))) return false;
    if (exclude !== 'outcome' && outcomeFilter.size > 0 && (row.outcome === 'unknown' || !outcomeFilter.has(row.outcome))) return false;
    if (exclude !== 'year') {
      if (yearFromNum !== null && (row.year === null || row.year < yearFromNum)) return false;
      if (yearToNum !== null && (row.year === null || row.year > yearToNum)) return false;
    }
    if (exclude !== 'pattern' && moveSans.length > 0 && historyIfMatchesPrefix(row.game.raw, moveSans) === null) {
      return false;
    }
    return true;
  };

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesFilters(row, null)),
    [rows, colorFilter, outcomeFilter, yearFromNum, yearToNum, moveSans],
  );

  const colorCounts = useMemo(() => {
    const counts: Record<Color, number> = { white: 0, black: 0 };
    for (const row of rows) if (row.color && matchesFilters(row, 'color')) counts[row.color]++;
    return counts;
  }, [rows, outcomeFilter, yearFromNum, yearToNum, moveSans]);

  const outcomeCounts = useMemo(() => {
    const counts: Record<FilterableOutcome, number> = { win: 0, loss: 0, draw: 0 };
    for (const row of rows) if (row.outcome !== 'unknown' && matchesFilters(row, 'outcome')) counts[row.outcome]++;
    return counts;
  }, [rows, colorFilter, yearFromNum, yearToNum, moveSans]);

  // Games passing every filter except the move pattern itself, i.e. exactly the set
  // the pattern filter should be narrowing down from. getNextMoveBreakdown does its
  // own prefix check internally to find what's actually playable next.
  const nextMoveStats = useMemo(() => {
    const otherFilteredGames = rows.filter((row) => matchesFilters(row, 'pattern')).map((row) => row.game);
    return getNextMoveBreakdown(otherFilteredGames, selectedPlayer, moveSans);
  }, [rows, colorFilter, outcomeFilter, yearFromNum, yearToNum, moveSans, selectedPlayer]);

  if (games.length <= 1) return null;

  return (
    <div>
      <div className="games-table__filters">
        <span className="games-table__filter-group">
          <span className="games-table__filter-label">Color</span>
          {COLOR_OPTIONS.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={colorFilter.has(option.value)}
                onChange={() => setColorFilter((prev) => toggle(prev, option.value))}
              />
              {option.label} ({colorCounts[option.value]})
            </label>
          ))}
        </span>
        <span className="games-table__filter-group">
          <span className="games-table__filter-label">Result</span>
          {OUTCOME_OPTIONS.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={outcomeFilter.has(option.value)}
                onChange={() => setOutcomeFilter((prev) => toggle(prev, option.value))}
              />
              {option.label} ({outcomeCounts[option.value]})
            </label>
          ))}
        </span>
        <span className="games-table__filter-group">
          <span className="games-table__filter-label">Year</span>
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

      <PatternFilter
        fen={fen}
        moves={moves}
        nextMoveOptions={nextMoveStats}
        onMove={makeMove}
        onPickMove={makeMoveSan}
        onTruncate={truncateTo}
        onUndo={undo}
        onReset={reset}
        atMax={atMax}
        maxPlies={maxPlies}
      />

      <OpeningStats stats={nextMoveStats} columnLabel={moveSans.length === 0 ? 'First move' : 'Next move'} />

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
