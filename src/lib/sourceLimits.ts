// Shared by every PGN input path (file upload, zip extraction, pasted text) so they
// enforce one consistent content ceiling instead of drifting apart -- the actual
// bottleneck these guard is chess.js parsing every game synchronously on the main
// thread (GamesTable's `rows` memo, loadLibraryGames), not IndexedDB/storage quota,
// which is comfortably larger than either limit below.
export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB -- .pgn uploads, zip uploads, and the PGN text extracted from a zip
export const MAX_PASTE_BYTES = 5 * 1024 * 1024; // 5 MB -- pasted PGN text (a manual, ad-hoc action)

export function formatSize(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1024 ** 2;
  if (mb >= 1) return `${Math.round(mb)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
