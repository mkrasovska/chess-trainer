import { useState } from 'react';
import { loadPgnGames, type PgnGame } from '../lib/pgnUtils';
import { formatSize, MAX_PASTE_BYTES } from '../lib/sourceLimits';

type PgnImportProps = {
  onLoad: (pgn: string) => void;
  // Exposes the pasted pool upward -- whose perspective to view it from (if any) is
  // picked later, as a filter in the games table itself.
  onGamesResolved: (games: PgnGame[]) => void;
  error: string | null;
};

export function PgnImport({ onLoad, onGamesResolved, error }: PgnImportProps) {
  const [pgnText, setPgnText] = useState('');
  const [pastedCount, setPastedCount] = useState<number | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);

  const handleLoad = () => {
    setPasteError(null);
    const byteSize = new Blob([pgnText]).size;
    if (byteSize > MAX_PASTE_BYTES) {
      setPasteError(
        `That's ${formatSize(byteSize)} of pasted text — over the ${formatSize(MAX_PASTE_BYTES)} limit. Paste fewer games, or use the file import instead.`,
      );
      return;
    }
    const games = loadPgnGames(pgnText);
    if (games.length <= 1) {
      // Single game (or unparseable text): go straight to the analysis board, as before.
      setPastedCount(null);
      onLoad(pgnText);
      return;
    }
    setPastedCount(games.length);
    onGamesResolved(games);
  };

  return (
    <div className="pgn-import layout-card">
      <textarea
        className="textarea textarea-bordered pgn-import__textarea"
        placeholder="Paste one or more PGN games here..."
        value={pgnText}
        onChange={(e) => setPgnText(e.target.value)}
        rows={6}
      />
      <button type="button" className="btn btn-primary btn-sm pgn-import__button" onClick={handleLoad}>
        Load
      </button>
      {error && <p className="pgn-import__error">{error}</p>}
      {pasteError && <p className="pgn-import__error">{pasteError}</p>}
      {pastedCount !== null && <p className="archive-import__status">{pastedCount} games pasted.</p>}
    </div>
  );
}
