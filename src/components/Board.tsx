import { Chessboard } from 'react-chessboard';
import type { Arrow } from 'react-chessboard';

type BoardProps = {
  fen: string;
  onMove: (from: string, to: string) => boolean;
  arrows?: Arrow[];
  id?: string;
  size?: number;
};

const DEFAULT_BOARD_SIZE = 480;

export function Board({ fen, onMove, arrows, id = 'main-board', size = DEFAULT_BOARD_SIZE }: BoardProps) {
  return (
    <Chessboard
      options={{
        id,
        position: fen,
        arrows,
        boardStyle: {
          width: size,
          height: size,
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
