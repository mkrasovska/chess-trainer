import { useCallback, useEffect, useRef, useState } from 'react';

export type EngineLine = {
  depth: number;
  scoreCp: number | null;
  scoreMate: number | null;
  pv: string[];
};

export function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [line, setLine] = useState<EngineLine | null>(null);
  const [bestMove, setBestMove] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker('/stockfish/stockfish-19-lite-single.js');
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<string>) => {
      const message = e.data;
      if (message === 'uciok') {
        worker.postMessage('isready');
      } else if (message === 'readyok') {
        setIsReady(true);
      } else if (message.startsWith('info') && message.includes(' pv ')) {
        const depthMatch = message.match(/depth (\d+)/);
        const cpMatch = message.match(/score cp (-?\d+)/);
        const mateMatch = message.match(/score mate (-?\d+)/);
        const pvMatch = message.match(/ pv (.+)/);
        if (depthMatch && pvMatch) {
          setLine({
            depth: Number(depthMatch[1]),
            scoreCp: cpMatch ? Number(cpMatch[1]) : null,
            scoreMate: mateMatch ? Number(mateMatch[1]) : null,
            pv: pvMatch[1].trim().split(' '),
          });
        }
      } else if (message.startsWith('bestmove')) {
        const parts = message.split(' ');
        setBestMove(parts[1] && parts[1] !== '(none)' ? parts[1] : null);
      }
    };

    worker.postMessage('uci');

    return () => {
      worker.terminate();
    };
  }, []);

  const evaluate = useCallback((fen: string, depth = 16) => {
    const worker = workerRef.current;
    if (!worker || !isReady) return;
    setBestMove(null);
    setLine(null);
    worker.postMessage('stop');
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${depth}`);
  }, [isReady]);

  return { isReady, line, bestMove, evaluate };
}
