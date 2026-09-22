import { Chessboard } from 'react-chessboard';

type BoardProps = {
  fen: string;
  onMove: (from: string, to: string) => boolean;
};

export function Board({ fen, onMove }: BoardProps) {
  return (
    <Chessboard
      options={{
        id: 'main-board',
        position: fen,
        onPieceDrop: ({ sourceSquare, targetSquare }) => {
          if (!targetSquare) return false;
          return onMove(sourceSquare, targetSquare);
        },
      }}
    />
  );
}
