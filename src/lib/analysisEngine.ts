import { getCachedEval, setCachedEval } from './evalCache';

export type CandidateMove = {
  moveUci: string;
  scoreCp: number | null;
  scoreMate: number | null;
  pv: string[];
};

export type PositionEval = {
  scoreCp: number | null;
  scoreMate: number | null;
  bestMoveUci: string | null;
  pv: string[];
  // All requested MultiPV lines, ranked best-first; candidates[0] is the same line as
  // the fields above. Just one entry unless `evaluate` was called with multiPv > 1.
  candidates: CandidateMove[];
};

export type AnalysisEngine = {
  evaluate: (fen: string, depth: number, multiPv?: number) => Promise<PositionEval>;
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
    // Keyed by MultiPV rank (1-based, per UCI). Re-emitted at increasing depth as the
    // engine searches deeper, so later lines for the same rank overwrite earlier ones.
    let byRank = new Map<number, CandidateMove>();

    worker.onmessage = (e: MessageEvent<string>) => {
      const message = e.data;
      if (message === 'uciok') {
        worker.postMessage('isready');
      } else if (message === 'readyok') {
        resolveReady({
          evaluate: (fen, depth, multiPv = 1) => {
            const cached = getCachedEval(fen, depth, multiPv);
            if (cached) return Promise.resolve(cached);
            return new Promise((resolve) => {
              byRank = new Map();
              pending = {
                resolve: (result) => {
                  setCachedEval(fen, depth, multiPv, result);
                  resolve(result);
                },
              };
              worker.postMessage(`setoption name MultiPV value ${multiPv}`);
              worker.postMessage(`position fen ${fen}`);
              worker.postMessage(`go depth ${depth}`);
            });
          },
          terminate: () => worker.terminate(),
        });
      } else if (message.startsWith('info') && message.includes(' pv ')) {
        const cpMatch = message.match(/score cp (-?\d+)/);
        const mateMatch = message.match(/score mate (-?\d+)/);
        const pvMatch = message.match(/ pv (.+)/);
        const multipvMatch = message.match(/multipv (\d+)/);
        if (!pvMatch) return;
        const rank = multipvMatch ? Number(multipvMatch[1]) : 1;
        const pv = pvMatch[1].trim().split(' ');
        byRank.set(rank, {
          moveUci: pv[0],
          scoreCp: cpMatch ? Number(cpMatch[1]) : null,
          scoreMate: mateMatch ? Number(mateMatch[1]) : null,
          pv,
        });
      } else if (message.startsWith('bestmove')) {
        const parts = message.split(' ');
        const bestMoveUci = parts[1] && parts[1] !== '(none)' ? parts[1] : null;
        const candidates = [...byRank.keys()].sort((a, b) => a - b).map((rank) => byRank.get(rank)!);
        const top = candidates[0];
        pending?.resolve({
          scoreCp: top?.scoreCp ?? null,
          scoreMate: top?.scoreMate ?? null,
          bestMoveUci,
          pv: top?.pv ?? [],
          candidates,
        });
        pending = null;
      }
    };

    worker.postMessage('uci');
  });
}
