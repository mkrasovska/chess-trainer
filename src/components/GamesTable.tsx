import { useEffect, useMemo, useState } from 'react';
import { OpeningStats } from './OpeningStats';
import { PatternFilter } from './PatternFilter';
import { usePrepLine } from '../hooks/usePrepLine';
import { getHistory, historyMatchesPrefix } from '../lib/prepMatch';
import { getColor, getNextMoveBreakdown, getOutcome, getYear, type Color, type Outcome } from '../lib/gameStats';
import { findPlayersInGames, MAX_PLAYERS, type PlayerMatch } from '../lib/playerMatch';
import type { PgnGame } from '../lib/pgnUtils';

type GamesTableProps = {
  games: PgnGame[];
  onSelectGame: (pgn: string) => void;
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

// Parsed once per game (not per filter check) since chess.js parsing is the
// expensive part of matching a game against the move-pattern filter.
type HistoryRow = {
  game: PgnGame;
  year: number | null;
  history: string[] | null;
};

type Row = HistoryRow & {
  color: Color | null;
  outcome: Outcome;
};

type FilterGroup = 'color' | 'outcome' | 'year' | 'pattern';

export function GamesTable({ games, onSelectGame }: GamesTableProps) {
  // Player is a filter like any other below (Color/Result/Year) -- whose own games
  // these are isn't known from the source, so it's picked here, from a dropdown of
  // every distinct identity found in the pool, not passed in from outside.
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerMatch | null>(null);
  // The <input list> text -- kept separate from selectedPlayer so partial typing
  // (not yet matching any suggestion exactly) doesn't itself count as a selection.
  const [playerQuery, setPlayerQuery] = useState('');

  const [colorFilter, setColorFilter] = useState<Set<Color>>(new Set());
  const [outcomeFilter, setOutcomeFilter] = useState<Set<FilterableOutcome>>(new Set());
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');

  // A new source (different `games` identity) invalidates every filter choice made
  // against the previous one -- otherwise the previous source's player/filters would
  // keep being applied (and shown) against the new pool.
  useEffect(() => {
    setSelectedPlayer(null);
    setPlayerQuery('');
    setColorFilter(new Set());
    setOutcomeFilter(new Set());
    setYearFrom('');
    setYearTo('');
  }, [games]);

  const allPlayers = useMemo(() => findPlayersInGames(games, '', MAX_PLAYERS), [games]);
  const playerKey = (p: PlayerMatch) => `${p.name}:${p.fideId ?? ''}`;
  // Just the name (plus FIDE ID to disambiguate same-named players) -- this is what
  // actually sits in the (editable) input once picked, so a volatile "N games" count
  // baked into that same text would look like a stray, editable part of the name.
  const playerIdentifier = (p: PlayerMatch) => `${p.name}${p.fideId ? ` (FIDE ${p.fideId})` : ''}`;

  const { fen, moves, makeMove, makeMoveSan, undo, truncateTo, reset } = usePrepLine();
  const moveSans = useMemo(() => moves.map((m) => m.san), [moves]);

  // Parsing every game's move history (chess.js) is the one genuinely expensive step
  // here -- for a big archive it's slow enough to visibly freeze the tab, with no
  // feedback, if done inline. Building it in an effect instead of a plain memo lets
  // the loading state below actually paint (via the rAF) before that work blocks the
  // thread, and -- crucially -- keys it ONLY on `games`, not `selectedPlayer`, so
  // picking a different player or going "back to players" (which only changes how
  // color/outcome are computed per game, not the parse itself) stays instant instead
  // of re-parsing everything all over again.
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [isBuilding, setIsBuilding] = useState(true);

  useEffect(() => {
    setIsBuilding(true);
  }, [games]);

  useEffect(() => {
    if (!isBuilding) return;
    const id = requestAnimationFrame(() => {
      setHistoryRows(games.map((game) => ({ game, year: getYear(game.headers), history: getHistory(game.raw) })));
      setIsBuilding(false);
    });
    return () => cancelAnimationFrame(id);
  }, [isBuilding, games]);

  // Cheap, player-dependent layer on top of the parsed pool -- just a plain map, so
  // switching perspective (or clearing it) never re-triggers the parse above.
  const rows = useMemo(
    () =>
      historyRows.map((row) => {
        const color = selectedPlayer ? getColor(row.game.headers, selectedPlayer) : null;
        return { ...row, color, outcome: getOutcome(row.game.headers, color) };
      }),
    [historyRows, selectedPlayer],
  );

  const yearFromNum = yearFrom.trim() ? Number(yearFrom) : null;
  const yearToNum = yearTo.trim() ? Number(yearTo) : null;

  // Checks a row against every active filter except `exclude`, so each filter group's
  // own counters reflect every OTHER group's current selection without zeroing itself out.
  const matchesFilters = (row: Row, exclude: FilterGroup | null): boolean => {
    // Baseline, not a toggleable filter group: once a player is selected, only their
    // own games count at all -- row.color is null for any game they don't appear in.
    // The Color/Result checkboxes below narrow further WITHIN that, same as before.
    if (selectedPlayer && row.color === null) return false;
    if (exclude !== 'color' && colorFilter.size > 0 && (row.color === null || !colorFilter.has(row.color))) return false;
    if (exclude !== 'outcome' && outcomeFilter.size > 0 && (row.outcome === 'unknown' || !outcomeFilter.has(row.outcome))) return false;
    if (exclude !== 'year') {
      if (yearFromNum !== null && (row.year === null || row.year < yearFromNum)) return false;
      if (yearToNum !== null && (row.year === null || row.year > yearToNum)) return false;
    }
    if (exclude !== 'pattern' && moveSans.length > 0 && !historyMatchesPrefix(row.history, moveSans)) return false;
    return true;
  };

  // Tallies rows matching `keyOf` into counts, applying every filter except `exclude` —
  // shared by colorCounts/outcomeCounts, which differ only in which field they key by.
  const countBy = <K extends string>(exclude: FilterGroup, keys: readonly K[], keyOf: (row: Row) => K | null) => {
    const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
    for (const row of rows) {
      const key = keyOf(row);
      if (key !== null && matchesFilters(row, exclude)) counts[key]++;
    }
    return counts;
  };

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesFilters(row, null)),
    [rows, colorFilter, outcomeFilter, yearFromNum, yearToNum, moveSans],
  );

  const colorCounts = useMemo(
    () => countBy('color', ['white', 'black'] as const, (row) => row.color),
    [rows, outcomeFilter, yearFromNum, yearToNum, moveSans],
  );

  const outcomeCounts = useMemo(
    () => countBy('outcome', ['win', 'loss', 'draw'] as const, (row) => (row.outcome === 'unknown' ? null : row.outcome)),
    [rows, colorFilter, yearFromNum, yearToNum, moveSans],
  );

  // Rows passing every filter except the move pattern itself, i.e. exactly the set
  // the pattern filter should be narrowing down from. getNextMoveBreakdown does its
  // own prefix check internally to find what's actually playable next. Needs a
  // selectedPlayer to compute win/loss/draw from, so it's just empty without one --
  // the pattern filter and opening-stats card that consume this aren't rendered then.
  const nextMoveStats = useMemo(() => {
    if (!selectedPlayer) return [];
    const otherFilteredRows = rows.filter((row) => matchesFilters(row, 'pattern'));
    return getNextMoveBreakdown(
      otherFilteredRows.map((row) => ({ headers: row.game.headers, history: row.history })),
      selectedPlayer,
      moveSans,
    );
  }, [rows, colorFilter, outcomeFilter, yearFromNum, yearToNum, moveSans, selectedPlayer]);

  if (isBuilding) {
    return (
      <div className="layout-card layout-card--full">
        <p className="games-table__loading">
          <span className="loading loading-spinner loading-sm" />
          Loading {games.length} games...
        </p>
      </div>
    );
  }

  // Each section is its own top-level "block" (a sibling in the caller's .source-grid),
  // not nested under one shared wrapper, so the grid can lay filters/stats/table out
  // as separate cards instead of one tall column.
  return (
    <>
      <div className={`layout-card${outcomeFilter.size > 0 ? ' layout-card--full' : ''}`}>
        <div className="games-table__filters">
          <span className="games-table__filter-group">
            <span className="games-table__filter-label">Player</span>
            <input
              type="text"
              list="games-table-players"
              className="input input-bordered input-xs games-table__player-select"
              placeholder="All players"
              value={playerQuery}
              onChange={(e) => {
                const value = e.target.value;
                setPlayerQuery(value);
                // Only an exact match (i.e. an actual pick from the list, not partial
                // typing) counts as a selection.
                setSelectedPlayer(allPlayers.find((p) => playerIdentifier(p) === value) ?? null);
              }}
            />
            <datalist id="games-table-players">
              {allPlayers.map((player) => (
                <option
                  key={playerKey(player)}
                  value={playerIdentifier(player)}
                  label={`${player.gameCount} game${player.gameCount === 1 ? '' : 's'}`}
                />
              ))}
            </datalist>
            {selectedPlayer && (
              <span className="games-table__player-count">
                {selectedPlayer.gameCount} game{selectedPlayer.gameCount === 1 ? '' : 's'}
              </span>
            )}
          </span>
          <span className="games-table__filter-group">
            <span className="games-table__filter-label">Year</span>
            <input
              type="number"
              className="input input-bordered input-xs games-table__year-input"
              placeholder="From"
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
            />
            <span>–</span>
            <input
              type="number"
              className="input input-bordered input-xs games-table__year-input"
              placeholder="To"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
            />
          </span>
          {selectedPlayer && (
            <>
              <span className="games-table__filter-group">
                <span className="games-table__filter-label">Color</span>
                {COLOR_OPTIONS.map((option) => (
                  <label key={option.value}>
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
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
                      className="checkbox checkbox-sm"
                      checked={outcomeFilter.has(option.value)}
                      onChange={() => setOutcomeFilter((prev) => toggle(prev, option.value))}
                    />
                    {option.label} ({outcomeCounts[option.value]})
                  </label>
                ))}
              </span>
            </>
          )}
        </div>

        {selectedPlayer && (
          <PatternFilter
            fen={fen}
            moves={moves}
            nextMoveOptions={nextMoveStats}
            onMove={makeMove}
            onPickMove={makeMoveSan}
            onTruncate={truncateTo}
            onUndo={undo}
            onReset={reset}
          />
        )}
      </div>

      {selectedPlayer && outcomeFilter.size === 0 && (
        <div className="layout-card">
          <h2>Statistics for {selectedPlayer.name}</h2>
          <OpeningStats stats={nextMoveStats} columnLabel={moveSans.length === 0 ? 'First move' : 'Next move'} />
        </div>
      )}

      <div className="layout-card layout-card--full">
        <p className="games-table__filters-count">
          Showing {filteredRows.length} of {games.length} games
        </p>
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
    </>
  );
}
