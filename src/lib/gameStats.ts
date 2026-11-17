import { historyIfMatchesPrefix } from './prepMatch';
import type { PlayerMatch } from './playerMatch';
import type { PgnGame } from './pgnUtils';

export type Color = 'white' | 'black';
export type Outcome = 'win' | 'loss' | 'draw' | 'unknown';

export function getYear(headers: Record<string, string>): number | null {
  const date = headers.Date ?? headers.EventDate ?? '';
  const year = Number(date.split('.')[0]);
  return Number.isInteger(year) && year > 0 ? year : null;
}

export function isSelectedSide(headers: Record<string, string>, side: 'White' | 'Black', player: PlayerMatch): boolean {
  if (headers[side] !== player.name) return false;
  return (headers[`${side}FideId`] ?? null) === player.fideId;
}

export function getColor(headers: Record<string, string>, player: PlayerMatch): Color | null {
  if (isSelectedSide(headers, 'White', player)) return 'white';
  if (isSelectedSide(headers, 'Black', player)) return 'black';
  return null;
}

export function getOutcome(headers: Record<string, string>, color: Color | null): Outcome {
  if (!color) return 'unknown';
  const result = headers.Result;
  if (result === '1/2-1/2') return 'draw';
  if (result === '1-0') return color === 'white' ? 'win' : 'loss';
  if (result === '0-1') return color === 'black' ? 'win' : 'loss';
  return 'unknown';
}

type Record_ = { wins: number; losses: number; draws: number; count: number };

function makeRecord(): Record_ {
  return { wins: 0, losses: 0, draws: 0, count: 0 };
}

function tallyOutcome(record: Record_, outcome: Outcome) {
  record.count++;
  if (outcome === 'win') record.wins++;
  else if (outcome === 'loss') record.losses++;
  else if (outcome === 'draw') record.draws++;
}

export type OpeningStat = {
  name: string;
  wins: number;
  losses: number;
  draws: number;
  count: number;
};

/**
 * Win/loss/draw breakdown of whichever move came right after `priorMoveSans`,
 * among games whose actual history starts with that exact sequence. An empty
 * `priorMoveSans` gives the breakdown of the literal first move.
 */
export function getNextMoveBreakdown(games: PgnGame[], player: PlayerMatch, priorMoveSans: string[]): OpeningStat[] {
  const byMove = new Map<string, Record_>();

  for (const game of games) {
    const color = getColor(game.headers, player);
    if (!color) continue;
    const outcome = getOutcome(game.headers, color);

    const history = historyIfMatchesPrefix(game.raw, priorMoveSans);
    const nextMove = history?.[priorMoveSans.length];
    if (!nextMove) continue;

    const record = byMove.get(nextMove) ?? makeRecord();
    tallyOutcome(record, outcome);
    byMove.set(nextMove, record);
  }

  return Array.from(byMove.entries())
    .map(([move, record]) => ({ name: move, ...record }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

