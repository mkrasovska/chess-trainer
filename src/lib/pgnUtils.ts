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
  // Normalize CRLF (common in exports like chess-results.com) so the line-anchored
  // regex below -- which expects "]" to be the very last character before "\n" --
  // doesn't silently fail to match every header on a Windows-style line ending.
  const normalized = gameText.replace(/\r\n/g, '\n');
  const headerRegex = /^\[(\w+)\s+"(.*)"\]$/gm;
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(normalized))) {
    headers[match[1]] = match[2];
  }
  return headers;
}

export function loadPgnGames(pgnText: string): PgnGame[] {
  return splitPgnGames(pgnText).map((raw) => ({ raw, headers: parsePgnHeaders(raw) }));
}
