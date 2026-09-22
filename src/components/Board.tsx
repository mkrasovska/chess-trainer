import { Chessboard } from 'react-chessboard';
import type { Arrow } from 'react-chessboard';

type BoardProps = {
  fen: string;
  onMove: (from: string, to: string) => boolean;
  arrows?: Arrow[];
};

const BOARD_SIZE = 480;

export function Board({ fen, onMove, arrows }: BoardProps) {
  return (
    <Chessboard
      options={{
        id: 'main-board',
        position: fen,
        arrows,
        boardStyle: {
          width: BOARD_SIZE,
          height: BOARD_SIZE,
          gridTemplateRows: 'repeat(8, 1fr)',
        },
        onPieceDrop: ({ sourceSquare, targetSquare }) => {
          if (!targetSquare) return false;
          return onMove(sourceSquare, targetSquare);
        },
      }}
    />
  );
}
