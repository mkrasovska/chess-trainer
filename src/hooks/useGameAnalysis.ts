import { useCallback, useRef, useState } from 'react';
import { createAnalysisEngine, type AnalysisEngine, type PositionEval } from '../lib/analysisEngine';
import { classifyGame, type MoveQuality } from '../lib/moveQuality';

// Shallower than the single-move analysis depth (20) -- this scans every ply in a
// loop, so it trades precision for speed; the blunder/mistake/inaccuracy thresholds
// are coarse enough (50/130/300cp) that this rarely flips a classification.
const ANALYSIS_DEPTH = 16;

// Every ply is an independent search, so splitting the game across a few engines cuts
// wall-clock time roughly by this factor instead of running them one at a time on a
// single worker -- kept low enough that even a modest mobile CPU isn't overwhelmed.
const WORKER_COUNT = 3;

export function useGameAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [classifications, setClassifications] = useState<(MoveQuality | null)[]>([]);
  const cancelRef = useRef(false);

  const analyze = useCallback(async (fens: string[]) => {
    cancelRef.current = false;
    setIsAnalyzing(true);
    setProgress(0);
    setClassifications([]);

    const workerCount = Math.max(1, Math.min(WORKER_COUNT, fens.length));
    const engines = await Promise.all(Array.from({ length: workerCount }, () => createAnalysisEngine()));
    try {
      const positionEvals: PositionEval[] = new Array(fens.length);
      let completed = 0;

      // Each engine works through its own slice of indices (i, i+workerCount,
      // i+2*workerCount, ...) and writes straight into its own slots, so the final
      // array comes out in the right order regardless of which engine finishes which
      // position first or fastest.
      const runSlice = async (engine: AnalysisEngine, start: number) => {
        for (let i = start; i < fens.length; i += workerCount) {
          if (cancelRef.current) return;
          positionEvals[i] = await engine.evaluate(fens[i], ANALYSIS_DEPTH);
          completed += 1;
          setProgress(completed / fens.length);
        }
      };

      await Promise.all(engines.map((engine, i) => runSlice(engine, i)));

      if (!cancelRef.current) {
        setClassifications(classifyGame(positionEvals));
      }
    } finally {
      engines.forEach((engine) => engine.terminate());
      setIsAnalyzing(false);
    }
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const clear = useCallback(() => {
    setClassifications([]);
    setProgress(0);
  }, []);

  return { isAnalyzing, progress, classifications, analyze, cancel, clear };
}
