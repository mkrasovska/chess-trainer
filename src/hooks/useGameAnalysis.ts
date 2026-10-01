import { useCallback, useRef, useState } from 'react';
import { createAnalysisEngine, type PositionEval } from '../lib/analysisEngine';
import { classifyGame, type MoveQuality } from '../lib/moveQuality';

const ANALYSIS_DEPTH = 20;

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

    const engine = await createAnalysisEngine();
    try {
      const positionEvals: PositionEval[] = [];
      for (let i = 0; i < fens.length; i++) {
        if (cancelRef.current) break;
        positionEvals.push(await engine.evaluate(fens[i], ANALYSIS_DEPTH));
        setProgress((i + 1) / fens.length);
      }
      if (!cancelRef.current) {
        setClassifications(classifyGame(positionEvals));
      }
    } finally {
      engine.terminate();
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
