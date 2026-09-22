import { parsePgnHeaders, type PgnGame } from './pgnUtils';

export type ScanOptions = {
  term: string;
  maxResults: number;
  onProgress?: (bytesRead: number) => void;
  shouldStop?: () => boolean;
};

export type ScanResult = {
  games: PgnGame[];
  hitLimit: boolean;
  cancelled: boolean;
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function headerBlock(gameText: string): string {
  const end = gameText.indexOf('\n\n');
  return end === -1 ? gameText : gameText.slice(0, end);
}

function matchesPlayer(gameText: string, matcher: RegExp): PgnGame | null {
  if (!matcher.test(headerBlock(gameText))) return null;
  const headers = parsePgnHeaders(gameText);
  const white = headers.White ?? '';
  const black = headers.Black ?? '';
  if (!matcher.test(white) && !matcher.test(black)) return null;
  return { raw: gameText.trim(), headers };
}

export async function scanPgnFile(file: File, options: ScanOptions): Promise<ScanResult> {
  const { term, maxResults, onProgress, shouldStop } = options;
  const matcher = new RegExp(escapeRegExp(term.trim()), 'i');
  const reader = file.stream().getReader();
  const decoder = new TextDecoder();

  const games: PgnGame[] = [];
  let buffer = '';
  let bytesRead = 0;
  let hitLimit = false;
  let cancelled = false;

  const collect = (gameText: string) => {
    const match = matchesPlayer(gameText, matcher);
    if (match) games.push(match);
    return games.length >= maxResults;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytesRead += value.byteLength;
      onProgress?.(bytesRead);

      buffer += decoder.decode(value, { stream: true });
      const segments = buffer.split(/\n(?=\[Event )/);
      buffer = segments.pop() ?? '';

      for (const segment of segments) {
        if (segment.trim() && collect(segment)) {
          hitLimit = true;
          break;
        }
      }

      if (hitLimit) break;
      if (shouldStop?.()) {
        cancelled = true;
        break;
      }
    }

    if (!hitLimit && !cancelled) {
      buffer += decoder.decode();
      if (buffer.trim()) collect(buffer);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return { games, hitLimit, cancelled };
}
