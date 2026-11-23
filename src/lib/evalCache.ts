import type { PositionEval } from './analysisEngine';

// Shared across every createAnalysisEngine() instance (module-level, not per-engine)
// so re-analyzing the same move, re-running "Analyze game" on an already-analyzed
// game, or overlapping positions between single-move and full-game analysis all skip
// redoing a search that's already been done -- a pure speed win, no accuracy tradeoff,
// since a cache hit only ever returns a result computed at that exact depth/multiPv.
const cache = new Map<string, PositionEval>();

function cacheKey(fen: string, depth: number, multiPv: number): string {
  return `${fen}|${depth}|${multiPv}`;
}

export function getCachedEval(fen: string, depth: number, multiPv: number): PositionEval | undefined {
  return cache.get(cacheKey(fen, depth, multiPv));
}

export function setCachedEval(fen: string, depth: number, multiPv: number, result: PositionEval): void {
  cache.set(cacheKey(fen, depth, multiPv), result);
}
