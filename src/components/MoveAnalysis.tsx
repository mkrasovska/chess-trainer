import { useState } from 'react';
import { useAiRequest } from '../hooks/useAiRequest';
import { AiResultPanel } from './AiResultPanel';
import { createAnalysisEngine } from '../lib/analysisEngine';
import { AI_PROVIDERS, getAiProvider } from '../lib/ai/provider';
import { buildMoveAnalysisPrompt } from '../lib/moveAnalysisPrompt';

const ANALYSIS_DEPTH = 20;

type MoveAnalysisProps = {
  fenBefore: string;
  fenAfter: string;
  moveSan: string;
  moverColor: 'w' | 'b';
};

export function MoveAnalysis({ fenBefore, fenAfter, moveSan, moverColor }: MoveAnalysisProps) {
  const { isLoading: isAsking, result, error, ask, clear } = useAiRequest();
  const [isEvaluating, setIsEvaluating] = useState(false);
  const providerLabel = AI_PROVIDERS.find((p) => p.id === getAiProvider())?.label ?? 'AI';

  const handleAnalyze = async () => {
    clear();
    setIsEvaluating(true);
    try {
      const engine = await createAnalysisEngine();
      try {
        const evalBefore = await engine.evaluate(fenBefore, ANALYSIS_DEPTH);
        const evalAfter = await engine.evaluate(fenAfter, ANALYSIS_DEPTH);
        setIsEvaluating(false);
        const prompt = buildMoveAnalysisPrompt({ fenBefore, moveSan, moverColor, evalBefore, evalAfter });
        await ask(prompt);
      } finally {
        engine.terminate();
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  const isBusy = isEvaluating || isAsking;

  return (
    <div className="move-analysis">
      <button type="button" onClick={handleAnalyze} disabled={isBusy}>
        {isBusy ? (isEvaluating ? 'Evaluating...' : `Asking ${providerLabel}...`) : `Analyze ${moveSan}`}
      </button>
      <AiResultPanel result={result} error={error} onClose={clear} />
    </div>
  );
}
