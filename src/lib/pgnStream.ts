import { parsePgnHeaders, type PgnGame } from './pgnUtils';

export type LibrarySource = {
  id: string;
  blob: Blob;
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Streams a blob and yields each raw game's text as soon as its boundary is found,
 * without ever holding the whole file in memory. Shared by every scan below so the
 * chunk-boundary splitting logic (and its edge cases) only has to be correct once.
 */
async function* iteratePgnSegments(source: Blob, onProgress?: (bytesRead: number) => void): AsyncGenerator<string> {
  const reader = source.stream().getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let bytesRead = 0;

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
        if (segment.trim()) yield segment;
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) yield buffer;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

// --- Phase 1: find distinct player identities matching a name -------------------

export type PlayerMatch = {
  name: string;
  fideId: string | null;
  gameCount: number;
};

export type PlayerScanOptions = {
  term: string;
  maxPlayers: number;
  onProgress?: (bytesRead: number) => void;
  shouldStop?: () => boolean;
};

export type PlayerScanResult = {
  players: PlayerMatch[];
  hitLimit: boolean;
  cancelled: boolean;
};

function playerKey(name: string, fideId: string | null): string {
  return fideId ? `id:${fideId}` : `name:${name}`;
}

export async function scanPlayers(sources: LibrarySource[], options: PlayerScanOptions): Promise<PlayerScanResult> {
  const { term, maxPlayers, onProgress, shouldStop } = options;
  const matcher = new RegExp(escapeRegExp(term.trim()), 'i');
  const found = new Map<string, PlayerMatch>();
  let hitLimit = false;
  let cancelled = false;
  let bytesBefore = 0;

  outer: for (const source of sources) {
    for await (const segment of iteratePgnSegments(source.blob, (bytesRead) => onProgress?.(bytesBefore + bytesRead))) {
      const headers = parsePgnHeaders(segment);

      for (const side of ['White', 'Black'] as const) {
        const name = headers[side];
        if (!name || !matcher.test(name)) continue;

        const fideId = headers[`${side}FideId`] ?? null;
        const key = playerKey(name, fideId);
        const existing = found.get(key);
        if (existing) {
          existing.gameCount += 1;
        } else {
          if (found.size >= maxPlayers) {
            hitLimit = true;
            break outer;
          }
          found.set(key, { name, fideId, gameCount: 1 });
        }
      }

      if (shouldStop?.()) {
        cancelled = true;
        break outer;
      }
    }
    bytesBefore += source.blob.size;
  }

  const players = Array.from(found.values()).sort(
    (a, b) => b.gameCount - a.gameCount || a.name.localeCompare(b.name),
  );
  return { players, hitLimit, cancelled };
}

// --- Phase 2: fetch every game for one specific, already-identified player ------

export type ScanResult = {
  games: PgnGame[];
  hitLimit: boolean;
  cancelled: boolean;
};

export type PlayerGamesOptions = {
  name: string;
  fideId: string | null;
  maxResults: number;
  onProgress?: (bytesRead: number) => void;
  shouldStop?: () => boolean;
};

export async function scanGamesForPlayer(sources: LibrarySource[], options: PlayerGamesOptions): Promise<ScanResult> {
  const { name, fideId, maxResults, onProgress, shouldStop } = options;
  const games: PgnGame[] = [];
  let hitLimit = false;
  let cancelled = false;
  let bytesBefore = 0;

  outer: for (const source of sources) {
    for await (const segment of iteratePgnSegments(source.blob, (bytesRead) => onProgress?.(bytesBefore + bytesRead))) {
      const headers = parsePgnHeaders(segment);
      const isMatch =
        (headers.White === name && (headers.WhiteFideId ?? null) === fideId) ||
        (headers.Black === name && (headers.BlackFideId ?? null) === fideId);

      if (isMatch) {
        games.push({ raw: segment.trim(), headers });
        if (games.length >= maxResults) {
          hitLimit = true;
          break outer;
        }
      }

      if (shouldStop?.()) {
        cancelled = true;
        break outer;
      }
    }
    bytesBefore += source.blob.size;
  }

  return { games, hitLimit, cancelled };
}
