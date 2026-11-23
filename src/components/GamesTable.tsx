import { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
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
  // Whether any selected player appears in this game (OR across the selection) --
  // true unconditionally when none are selected, i.e. no baseline to apply yet.
  matchesSelectedPlayers: boolean;
};

type FilterGroup = 'color' | 'outcome' | 'year' | 'pattern';

const playerKey = (p: PlayerMatch) => `${p.name}:${p.fideId ?? ''}`;
// Just the name (plus FIDE ID to disambiguate same-named players) -- this is what
// actually sits in the search input once picked, so a volatile "N games" count baked
// into the same label would look like a stray part of the name.
const playerIdentifier = (p: PlayerMatch) => `${p.name}${p.fideId ? ` (FIDE ${p.fideId})` : ''}`;

export function GamesTable({ games, onSelectGame }: GamesTableProps) {
  // Player is a filter like any other below (Color/Result/Year) -- whose own games
  // these are isn't known from the source, so it's picked here, from a search of
  // every distinct identity found in the pool, not passed in from outside. Multiple
  // can be picked (OR'd together -- a game shows if ANY of them appears in it); the
  // Color/Result filters, pattern-filter, and stats card only make sense from a
  // single perspective, so they only appear while exactly one is selected.
  const [selectedPlayers, setSelectedPlayers] = useState<PlayerMatch[]>([]);
  const perspectivePlayer = selectedPlayers.length === 1 ? selectedPlayers[0] : null;

  const [colorFilter, setColorFilter] = useState<Set<Color>>(new Set());
  const [outcomeFilter, setOutcomeFilter] = useState<Set<FilterableOutcome>>(new Set());
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');

  // A new source (different `games` identity) invalidates every filter choice made
  // against the previous one -- otherwise the previous source's player/filters would
  // keep being applied (and shown) against the new pool.
  useEffect(() => {
    setSelectedPlayers([]);
    setColorFilter(new Set());
    setOutcomeFilter(new Set());
    setYearFrom('');
    setYearTo('');
  }, [games]);

  const allPlayers = useMemo(() => findPlayersInGames(games, '', MAX_PLAYERS), [games]);

  const removePlayer = (player: PlayerMatch) => {
    setSelectedPlayers((prev) => prev.filter((p) => playerKey(p) !== playerKey(player)));
  };

  const { fen, moves, makeMove, makeMoveSan, undo, truncateTo, reset } = usePrepLine();
  const moveSans = useMemo(() => moves.map((m) => m.san), [moves]);

  // Parsing every game's move history (chess.js) is the one genuinely expensive step
  // here -- for a big archive it's slow enough to visibly freeze the tab, with no
  // feedback, if done inline. Building it in an effect instead of a plain memo lets
  // the loading state below actually paint (via the rAF) before that work blocks the
  // thread, and -- crucially -- keys it ONLY on `games`, not `selectedPlayers`, so
  // picking, removing, or clearing players (which only changes how color/outcome/
  // matching are computed per game, not the parse itself) stays instant instead of
  // re-parsing everything all over again.
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
        const color = perspectivePlayer ? getColor(row.game.headers, perspectivePlayer) : null;
        const matchesSelectedPlayers =
          selectedPlayers.length === 0 || selectedPlayers.some((p) => getColor(row.game.headers, p) !== null);
        return { ...row, color, outcome: getOutcome(row.game.headers, color), matchesSelectedPlayers };
      }),
    [historyRows, selectedPlayers, perspectivePlayer],
  );

  const yearFromNum = yearFrom.trim() ? Number(yearFrom) : null;
  const yearToNum = yearTo.trim() ? Number(yearTo) : null;

  // Checks a row against every active filter except `exclude`, so each filter group's
  // own counters reflect every OTHER group's current selection without zeroing itself out.
  const matchesFilters = (row: Row, exclude: FilterGroup | null): boolean => {
    // Baseline, not a toggleable filter group: once one or more players are
    // selected, only games involving at least one of them count at all. The
    // Color/Result checkboxes below narrow further WITHIN that (perspective-
    // dependent, so only shown -- and only meaningful -- for a single selection).
    if (!row.matchesSelectedPlayers) return false;
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
  // single perspective player to compute win/loss/draw from, so it's just empty
  // without one -- the pattern filter and opening-stats card that consume this
  // aren't rendered then.
  const nextMoveStats = useMemo(() => {
    if (!perspectivePlayer) return [];
    const otherFilteredRows = rows.filter((row) => matchesFilters(row, 'pattern'));
    return getNextMoveBreakdown(
      otherFilteredRows.map((row) => ({ headers: row.game.headers, history: row.history })),
      perspectivePlayer,
      moveSans,
    );
  }, [rows, colorFilter, outcomeFilter, yearFromNum, yearToNum, moveSans, perspectivePlayer]);

  if (isBuilding) {
    return (
      <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <CircularProgress size={18} />
        <Typography>Loading {games.length} games...</Typography>
      </Paper>
    );
  }

  // Each section is its own top-level "block" (a sibling in the caller's layout grid),
  // not nested under one shared wrapper, so the grid can lay filters/stats/table out
  // as separate cards instead of one tall column.
  return (
    <>
      <Paper
        variant="outlined"
        sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, gridColumn: outcomeFilter.size > 0 ? '1 / -1' : undefined }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
          <Box sx={{ width: 280 }}>
            <Autocomplete
              multiple
              disableClearable
              size="small"
              options={allPlayers}
              value={selectedPlayers}
              onChange={(_e, newValue) => setSelectedPlayers(newValue)}
              getOptionLabel={playerIdentifier}
              isOptionEqualToValue={(a, b) => playerKey(a) === playerKey(b)}
              renderValue={() => null}
              renderOption={({ key: _key, ...props }, option) => (
                <Box component="li" key={playerKey(option)} {...props}>
                  {playerIdentifier(option)} -- {option.gameCount} game{option.gameCount === 1 ? '' : 's'}
                </Box>
              )}
              renderInput={(params) => <TextField {...params} label="Player" placeholder="All players" />}
            />
            {selectedPlayers.length > 0 && (
              <Stack sx={{ mt: 1 }}>
                {selectedPlayers.map((player) => (
                  <Box key={playerKey(player)} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {playerIdentifier(player)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                      {player.gameCount} game{player.gameCount === 1 ? '' : 's'}
                    </Typography>
                    <IconButton size="small" aria-label={`Remove ${player.name}`} onClick={() => removePlayer(player)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              type="number"
              label="Year from"
              size="small"
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
              sx={{ width: 110 }}
            />
            <TextField
              type="number"
              label="Year to"
              size="small"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
              sx={{ width: 110 }}
            />
          </Box>

          {perspectivePlayer && (
            <>
              <FormGroup row sx={{ alignItems: 'center' }}>
                <Typography variant="body2" sx={{ mr: 1, fontWeight: 700 }} color="text.secondary">
                  Color
                </Typography>
                {COLOR_OPTIONS.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    control={
                      <Checkbox
                        size="small"
                        checked={colorFilter.has(option.value)}
                        onChange={() => setColorFilter((prev) => toggle(prev, option.value))}
                      />
                    }
                    label={`${option.label} (${colorCounts[option.value]})`}
                  />
                ))}
              </FormGroup>
              <FormGroup row sx={{ alignItems: 'center' }}>
                <Typography variant="body2" sx={{ mr: 1, fontWeight: 700 }} color="text.secondary">
                  Result
                </Typography>
                {OUTCOME_OPTIONS.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    control={
                      <Checkbox
                        size="small"
                        checked={outcomeFilter.has(option.value)}
                        onChange={() => setOutcomeFilter((prev) => toggle(prev, option.value))}
                      />
                    }
                    label={`${option.label} (${outcomeCounts[option.value]})`}
                  />
                ))}
              </FormGroup>
            </>
          )}
        </Box>

        {perspectivePlayer && (
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
      </Paper>

      {perspectivePlayer && outcomeFilter.size === 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Statistics for {perspectivePlayer.name}
          </Typography>
          <OpeningStats stats={nextMoveStats} columnLabel={moveSans.length === 0 ? 'First move' : 'Next move'} />
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 2, gridColumn: '1 / -1' }}>
        <Typography variant="h6" gutterBottom>
          Showing {filteredRows.length} of {games.length} games
        </Typography>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Year</TableCell>
                <TableCell>White</TableCell>
                <TableCell>Elo</TableCell>
                <TableCell>Black</TableCell>
                <TableCell>Elo</TableCell>
                <TableCell>Result</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map(({ game, color, year }, index) => (
                <TableRow key={index} hover sx={{ cursor: 'pointer' }} onClick={() => onSelectGame(game.raw)}>
                  <TableCell>{year ?? '?'}</TableCell>
                  <TableCell sx={{ fontWeight: color === 'white' ? 700 : 400 }}>{game.headers.White ?? '?'}</TableCell>
                  <TableCell>{game.headers.WhiteElo ?? '—'}</TableCell>
                  <TableCell sx={{ fontWeight: color === 'black' ? 700 : 400 }}>{game.headers.Black ?? '?'}</TableCell>
                  <TableCell>{game.headers.BlackElo ?? '—'}</TableCell>
                  <TableCell>{game.headers.Result ?? '?'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </>
  );
}
