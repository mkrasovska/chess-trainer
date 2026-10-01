export type PositionEval = {
  scoreCp: number | null;
  scoreMate: number | null;
  bestMoveUci: string | null;
  pv: string[];
};

export type AnalysisEngine = {
  evaluate: (fen: string, depth: number) => Promise<PositionEval>;
  terminate: () => void;
};

/**
 * A dedicated Stockfish worker for one-shot position evaluations, used for
 * batch full-game analysis. Kept separate from useStockfish's live eval-bar
 * worker so a long batch run never competes with it for engine commands.
 */
export function createAnalysisEngine(): Promise<AnalysisEngine> {
  return new Promise((resolveReady) => {
    const worker = new Worker(`${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`);
    let pending: { resolve: (result: PositionEval) => void } | null = null;
    let lastScoreCp: number | null = null;
    let lastScoreMate: number | null = null;
    let lastPv: string[] = [];

    worker.onmessage = (e: MessageEvent<string>) => {
      const message = e.data;
      if (message === 'uciok') {
        worker.postMessage('isready');
      } else if (message === 'readyok') {
        resolveReady({
          evaluate: (fen, depth) =>
            new Promise((resolve) => {
              lastScoreCp = null;
              lastScoreMate = null;
              lastPv = [];
              pending = { resolve };
              worker.postMessage(`position fen ${fen}`);
              worker.postMessage(`go depth ${depth}`);
            }),
          terminate: () => worker.terminate(),
        });
      } else if (message.startsWith('info') && message.includes(' pv ')) {
        const cpMatch = message.match(/score cp (-?\d+)/);
        const mateMatch = message.match(/score mate (-?\d+)/);
        const pvMatch = message.match(/ pv (.+)/);
        if (cpMatch) lastScoreCp = Number(cpMatch[1]);
        if (mateMatch) lastScoreMate = Number(mateMatch[1]);
        if (pvMatch) lastPv = pvMatch[1].trim().split(' ');
      } else if (message.startsWith('bestmove')) {
        const parts = message.split(' ');
        const bestMoveUci = parts[1] && parts[1] !== '(none)' ? parts[1] : null;
        pending?.resolve({ scoreCp: lastScoreCp, scoreMate: lastScoreMate, bestMoveUci, pv: lastPv });
        pending = null;
      }
    };

    worker.postMessage('uci');
  });
}
