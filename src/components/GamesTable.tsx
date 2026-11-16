import { useMemo, useState } from 'react';
import { useAiRequest } from '../hooks/useAiRequest';
import { AiResultPanel } from './AiResultPanel';
import { OpeningStats } from './OpeningStats';
import { AI_PROVIDERS, getAiProvider } from '../lib/ai/provider';
import {
  buildPlayerProfilePrompt,
  ECO_LABELS,
  ECO_ORDER,
  FIRST_MOVE_LABELS,
  FIRST_MOVE_ORDER,
  getColor,
  getEcoLetter,
  getFirstMove,
  getOpeningBreakdown,
  getOpeningName,
  getOutcome,
  getYear,
  type Color,
  type EcoLetter,
  type FirstMove,
  type Outcome,
} from '../lib/gameStats';
import type { PlayerMatch } from '../lib/pgnStream';
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

export function GamesTable({ games, onSelectGame, selectedPlayer }: GamesTableProps) {
  const [colorFilter, setColorFilter] = useState<Set<Color>>(new Set());
  const [outcomeFilter, setOutcomeFilter] = useState<Set<FilterableOutcome>>(new Set());
  const [ecoFilter, setEcoFilter] = useState<Set<EcoLetter>>(new Set());
  const [firstMoveFilter, setFirstMoveFilter] = useState<Set<FirstMove>>(new Set());
  const [openingNameFilter, setOpeningNameFilter] = useState<Set<string>>(new Set());
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const { isLoading: isAskingAboutPlayer, result: aboutPlayerResult, error: aboutPlayerError, ask: askAboutPlayer, clear: clearAboutPlayer } = useAiRequest();
  const providerLabel = AI_PROVIDERS.find((p) => p.id === getAiProvider())?.label ?? 'AI';

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
          openingName: getOpeningName(game.headers),
          year: getYear(game.headers),
        };
      }),
    [games, selectedPlayer],
  );

  const colorCounts = useMemo(() => {
    const counts: Record<Color, number> = { white: 0, black: 0 };
    for (const row of rows) if (row.color) counts[row.color]++;
    return counts;
  }, [rows]);

  const outcomeCounts = useMemo(() => {
    const counts: Record<FilterableOutcome, number> = { win: 0, loss: 0, draw: 0 };
    for (const row of rows) if (row.outcome !== 'unknown') counts[row.outcome]++;
    return counts;
  }, [rows]);

  const ecoCounts = useMemo(() => {
    const counts = new Map<EcoLetter, number>();
    for (const row of rows) if (row.eco) counts.set(row.eco, (counts.get(row.eco) ?? 0) + 1);
    return counts;
  }, [rows]);

  const availableEcoLetters = useMemo(
    () => ECO_ORDER.filter((letter) => rows.some((row) => row.eco === letter)),
    [rows],
  );

  const firstMoveCounts = useMemo(() => {
    const counts = new Map<FirstMove, number>();
    for (const row of rows) if (row.firstMove) counts.set(row.firstMove, (counts.get(row.firstMove) ?? 0) + 1);
    return counts;
  }, [rows]);

  const availableFirstMoves = useMemo(
    () => FIRST_MOVE_ORDER.filter((move) => rows.some((row) => row.firstMove === move)),
    [rows],
  );

  const availableOpeningNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (row.openingName) counts.set(row.openingName, (counts.get(row.openingName) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [rows]);

  const yearFromNum = yearFrom.trim() ? Number(yearFrom) : null;
  const yearToNum = yearTo.trim() ? Number(yearTo) : null;

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (colorFilter.size > 0 && (row.color === null || !colorFilter.has(row.color))) return false;
        if (outcomeFilter.size > 0 && (row.outcome === 'unknown' || !outcomeFilter.has(row.outcome))) return false;
        if (ecoFilter.size > 0 && (row.eco === null || !ecoFilter.has(row.eco))) return false;
        if (firstMoveFilter.size > 0 && (row.firstMove === null || !firstMoveFilter.has(row.firstMove))) return false;
        if (openingNameFilter.size > 0 && (row.openingName === null || !openingNameFilter.has(row.openingName))) return false;
        if (yearFromNum !== null && (row.year === null || row.year < yearFromNum)) return false;
        if (yearToNum !== null && (row.year === null || row.year > yearToNum)) return false;
        return true;
      }),
    [rows, colorFilter, outcomeFilter, ecoFilter, firstMoveFilter, openingNameFilter, yearFromNum, yearToNum],
  );

  const openingStats = useMemo(
    () => getOpeningBreakdown(filteredRows.map((row) => row.game), selectedPlayer),
    [filteredRows, selectedPlayer],
  );

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
        {availableEcoLetters.length > 0 && (
          <span className="games-table__filter-group">
            <span className="games-table__filter-label">ECO</span>
            {availableEcoLetters.map((letter) => (
              <label key={letter} title={ECO_LABELS[letter]}>
                <input
                  type="checkbox"
                  checked={ecoFilter.has(letter)}
                  onChange={() => setEcoFilter((prev) => toggle(prev, letter))}
                />
                {letter} – {ECO_LABELS[letter]} ({ecoCounts.get(letter)})
              </label>
            ))}
          </span>
        )}
        {availableFirstMoves.length > 0 && (
          <span className="games-table__filter-group">
            <span className="games-table__filter-label">First move</span>
            {availableFirstMoves.map((move) => (
              <label key={move}>
                <input
                  type="checkbox"
                  checked={firstMoveFilter.has(move)}
                  onChange={() => setFirstMoveFilter((prev) => toggle(prev, move))}
                />
                {FIRST_MOVE_LABELS[move]} ({firstMoveCounts.get(move)})
              </label>
            ))}
          </span>
        )}
        {availableOpeningNames.length > 0 && (
          <span className="games-table__filter-group">
            <span className="games-table__filter-label">Opening</span>
            <div className="games-table__opening-list">
              {availableOpeningNames.map(([name, count]) => (
                <label key={name}>
                  <input
                    type="checkbox"
                    checked={openingNameFilter.has(name)}
                    onChange={() => setOpeningNameFilter((prev) => toggle(prev, name))}
                  />
                  {name} ({count})
                </label>
              ))}
            </div>
          </span>
        )}
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
        <button
          type="button"
          disabled={isAskingAboutPlayer || filteredRows.length === 0}
          onClick={() => askAboutPlayer(buildPlayerProfilePrompt(filteredRows.map((row) => row.game), selectedPlayer))}
        >
          {isAskingAboutPlayer ? `Asking ${providerLabel}...` : 'About player'}
        </button>
      </div>

      <AiResultPanel result={aboutPlayerResult} error={aboutPlayerError} onClose={clearAboutPlayer} />

      <OpeningStats stats={openingStats} />

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
