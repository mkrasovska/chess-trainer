export type PgnHeaders = Record<string, string>;

export type PgnGame = {
  raw: string;
  headers: PgnHeaders;
};

export function splitPgnGames(pgnText: string): string[] {
  const trimmed = pgnText.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/\n(?=\[Event )/)
    .map((game) => game.trim())
    .filter(Boolean);
}

export function parsePgnHeaders(gameText: string): PgnHeaders {
  const headers: PgnHeaders = {};
  const headerRegex = /^\[(\w+)\s+"(.*)"\]$/gm;
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(gameText))) {
    headers[match[1]] = match[2];
  }
  return headers;
}

export function loadPgnGames(pgnText: string): PgnGame[] {
  return splitPgnGames(pgnText).map((raw) => ({ raw, headers: parsePgnHeaders(raw) }));
}
