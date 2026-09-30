import type { PlayerMatch } from './pgnStream';
import type { PgnGame } from './pgnUtils';

export type Color = 'white' | 'black';
export type Outcome = 'win' | 'loss' | 'draw' | 'unknown';
export type EcoLetter = 'A' | 'B' | 'C' | 'D' | 'E';
export type FirstMove = 'e4' | 'd4' | 'c4' | 'Nf3' | 'other';

export const ECO_LABELS: Record<EcoLetter, string> = {
  A: 'Flank Openings',
  B: 'Semi-Open Games',
  C: 'Open Games',
  D: 'Closed & Queen’s Pawn',
  E: 'Indian Defenses',
};
export const ECO_ORDER: EcoLetter[] = ['A', 'B', 'C', 'D', 'E'];

export const FIRST_MOVE_LABELS: Record<FirstMove, string> = {
  e4: '1.e4',
  d4: '1.d4',
  c4: '1.c4',
  Nf3: '1.Nf3',
  other: 'Other',
};
export const FIRST_MOVE_ORDER: FirstMove[] = ['e4', 'd4', 'c4', 'Nf3', 'other'];

export function getYear(headers: Record<string, string>): number | null {
  const date = headers.Date ?? headers.EventDate ?? '';
  const year = Number(date.split('.')[0]);
  return Number.isInteger(year) && year > 0 ? year : null;
}

export function getEcoLetter(headers: Record<string, string>): EcoLetter | null {
  const letter = headers.ECO?.[0];
  return letter && (ECO_ORDER as string[]).includes(letter) ? (letter as EcoLetter) : null;
}

export function getOpeningName(headers: Record<string, string>): string | null {
  const name = headers.Opening?.trim();
  return name ? name : null;
}

export function getFirstMove(raw: string): FirstMove | null {
  const separatorIndex = raw.indexOf('\n\n');
  const moveText = separatorIndex === -1 ? raw : raw.slice(separatorIndex + 2);
  const match = moveText.match(/1\.\s*(\S+)/);
  if (!match) return null;
  const move = match[1].replace(/[+#!?]+$/g, '');
  if (move === 'e4' || move === 'd4' || move === 'c4' || move === 'Nf3') return move;
  return 'other';
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

function fmtRecord(r: Record_): string {
  return `${r.count} games (${r.wins}W ${r.losses}L ${r.draws}D)`;
}

function average(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

/** Builds a compact, plain-text statistical summary of a player's games, for feeding to an LLM. */
export function buildPlayerSummary(games: PgnGame[], player: PlayerMatch): string {
  const overall = makeRecord();
  const byColor: Record<Color, Record_> = { white: makeRecord(), black: makeRecord() };
  const byOpening = new Map<string, Record_>();
  const ownElos: number[] = [];
  const opponentElos: number[] = [];

  for (const game of games) {
    const color = getColor(game.headers, player);
    if (!color) continue;
    const outcome = getOutcome(game.headers, color);

    tallyOutcome(overall, outcome);
    tallyOutcome(byColor[color], outcome);

    const openingName = getOpeningName(game.headers) ?? (game.headers.ECO ? `ECO ${game.headers.ECO}` : null);
    if (openingName) {
      const record = byOpening.get(openingName) ?? makeRecord();
      tallyOutcome(record, outcome);
      byOpening.set(openingName, record);
    }

    const ownElo = Number(color === 'white' ? game.headers.WhiteElo : game.headers.BlackElo);
    const oppElo = Number(color === 'white' ? game.headers.BlackElo : game.headers.WhiteElo);
    if (Number.isFinite(ownElo) && ownElo > 0) ownElos.push(ownElo);
    if (Number.isFinite(oppElo) && oppElo > 0) opponentElos.push(oppElo);
  }

  const topOpenings = Array.from(byOpening.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([name, record]) => `- ${name}: ${fmtRecord(record)}`)
    .join('\n');

  const ownEloAvg = average(ownElos);
  const oppEloAvg = average(opponentElos);

  return [
    `Player: ${player.name}${player.fideId ? ` (FIDE ID ${player.fideId})` : ''}`,
    `Total games analyzed: ${overall.count}`,
    `Overall record: ${fmtRecord(overall)}`,
    `As White: ${fmtRecord(byColor.white)}`,
    `As Black: ${fmtRecord(byColor.black)}`,
    ownEloAvg !== null ? `Average own rating across these games: ${ownEloAvg}` : null,
    oppEloAvg !== null ? `Average opponent rating: ${oppEloAvg}` : null,
    'Most common openings/systems played:',
    topOpenings || '(no opening data available)',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

export function buildPlayerProfilePrompt(games: PgnGame[], player: PlayerMatch): string {
  const summary = buildPlayerSummary(games, player);
  return `You are a chess coach preparing a player profile from database statistics (not from watching them play live). Here is the data:

${summary}

Skip restating the win/loss/draw record -- that's already shown separately. Based only on this data, write a short scouting profile with these sections:
1. Favorite openings/systems, as White and as Black
2. Likely playing style (aggressive/tactical vs. positional/solid) -- infer this cautiously from opening choices, and say plainly that style can't be fully judged from results alone, only suggested by them
3. A practical suggestion for how an opponent could prepare against them

Keep it to about 90-120 words total, with short section headers. Be direct and specific to this data, not generic chess advice.`;
}
