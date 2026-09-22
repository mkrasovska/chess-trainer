import { useState } from 'react';

type PgnImportProps = {
  onLoad: (pgn: string) => void;
  error: string | null;
};

export function PgnImport({ onLoad, error }: PgnImportProps) {
  const [pgnText, setPgnText] = useState('');

  return (
    <div className="pgn-import">
      <textarea
        className="pgn-import__textarea"
        placeholder="Paste a PGN here..."
        value={pgnText}
        onChange={(e) => setPgnText(e.target.value)}
        rows={6}
      />
      <button type="button" className="pgn-import__button" onClick={() => onLoad(pgnText)}>
        Load game
      </button>
      {error && <p className="pgn-import__error">{error}</p>}
    </div>
  );
}
