import { Chessboard } from 'react-chessboard';
import type { Arrow } from 'react-chessboard';

type BoardProps = {
  fen: string;
  onMove: (from: string, to: string) => boolean;
  arrows?: Arrow[];
};

export function Board({ fen, onMove, arrows }: BoardProps) {
  return (
    <Chessboard
      options={{
        id: 'main-board',
        position: fen,
        arrows,
        onPieceDrop: ({ sourceSquare, targetSquare }) => {
          if (!targetSquare) return false;
          return onMove(sourceSquare, targetSquare);
        },
      }}
    />
  );
}
