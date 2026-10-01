import { useCallback, useEffect, useRef, useState } from 'react';

export type EngineLine = {
  depth: number;
  scoreCp: number | null;
  scoreMate: number | null;
  pv: string[];
};

type PendingSearch = {
  fen: string;
  depth: number;
};

export function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const isSearchingRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const pendingRef = useRef<PendingSearch | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [line, setLine] = useState<EngineLine | null>(null);
  const [bestMove, setBestMove] = useState<string | null>(null);

  const runSearch = useCallback(({ fen, depth }: PendingSearch) => {
    const worker = workerRef.current;
    if (!worker) return;
    isSearchingRef.current = true;
    stopRequestedRef.current = false;
    setBestMove(null);
    setLine(null);
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${depth}`);
  }, []);

  const startWorker = useCallback(() => {
    const worker = new Worker(`${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`);
    workerRef.current = worker;
    isSearchingRef.current = false;
    stopRequestedRef.current = false;
    setIsReady(false);

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
        isSearchingRef.current = false;
        const next = pendingRef.current;
        if (next) {
          pendingRef.current = null;
          runSearch(next);
        }
      }
    };

    worker.onerror = () => {
      worker.terminate();
      startWorker();
    };

    worker.postMessage('uci');
  }, [runSearch]);

  useEffect(() => {
    startWorker();
    return () => {
      workerRef.current?.terminate();
    };
  }, [startWorker]);

  const evaluate = useCallback((fen: string, depth = 18) => {
    if (!isReady) return;
    if (isSearchingRef.current) {
      pendingRef.current = { fen, depth };
      if (!stopRequestedRef.current) {
        stopRequestedRef.current = true;
        workerRef.current?.postMessage('stop');
      }
      return;
    }
    runSearch({ fen, depth });
  }, [isReady, runSearch]);

  return { isReady, line, bestMove, evaluate };
}
