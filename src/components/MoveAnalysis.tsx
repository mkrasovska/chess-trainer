import { useMemo, useState } from 'react';
import { useAiRequest } from '../hooks/useAiRequest';
import { AiResultPanel } from './AiResultPanel';
import { AiSettings } from './AiSettings';
import { createAnalysisEngine, type PositionEval } from '../lib/analysisEngine';
import { AI_PROVIDERS, getAiProvider, getModel, isAiConfigured } from '../lib/ai/provider';
import { formatRankedCandidates, formatScore, moverPerspective, sanToUci, type RankedCandidate } from '../lib/evalFormat';
import { buildMoveAnalysisPrompt } from '../lib/moveAnalysisPrompt';

// Deeper than the full-game batch analysis depth (16) -- this is 1-2 searches on
// demand for a move the user specifically wants to understand, so it's worth the
// extra ~1-2s for a score/best-move that's actually converged, especially in sharp
// tactical or endgame positions where shallower search can misjudge severity.
const ANALYSIS_DEPTH = 24;
const CANDIDATE_COUNT = 3;

type MoveAnalysisProps = {
  fenBefore: string;
  fenAfter: string;
  moveSan: string;
  moverColor: 'w' | 'b';
};

export function MoveAnalysis({ fenBefore, fenAfter, moveSan, moverColor }: MoveAnalysisProps) {
  const { isLoading: isAsking, result, error, ask, clear } = useAiRequest();
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [candidates, setCandidates] = useState<RankedCandidate[] | null>(null);
  const [playedScore, setPlayedScore] = useState<string | null>(null);
  // Kept so the (separate, opt-in) AI analysis button can build its prompt without
  // re-running Stockfish -- the engine evaluation and the AI call are now two
  // independent steps, not one bundled action.
  const [evals, setEvals] = useState<{ before: PositionEval; after: PositionEval } | null>(null);
  const providerLabel = AI_PROVIDERS.find((p) => p.id === getAiProvider())?.label ?? 'AI';

  // isAiConfigured/getModel read localStorage directly (AiSettings only persists on
  // Save), so this needs to be recomputed after a save -- aiConfigVersion is bumped
  // via AiSettings' onSaved to force that.
  const [aiConfigVersion, setAiConfigVersion] = useState(0);
  const aiReady = useMemo(() => isAiConfigured(), [aiConfigVersion]);
  const aiModel = useMemo(() => getModel(getAiProvider()), [aiConfigVersion]);
  const aiButtonTitle = aiReady ? aiModel : 'Please select AI model and set token to enable';

  const handleAnalyze = async () => {
    clear();
    setCandidates(null);
    setPlayedScore(null);
    setEvals(null);
    setIsEvaluating(true);
    try {
      const engine = await createAnalysisEngine();
      try {
        const evalBefore = await engine.evaluate(fenBefore, ANALYSIS_DEPTH, CANDIDATE_COUNT);
        const playedUci = sanToUci(fenBefore, moveSan);
        const isPlayedCandidate = evalBefore.candidates.some((c) => c.moveUci === playedUci);

        // Only needed when the move ISN'T one of the candidates above -- otherwise its
        // score is already shown there, and this fresh search could disagree with it.
        // Either way, the candidates list and the played-move score are set together
        // (not the candidates first, then the played score popping in later) so they
        // render in the same update instead of one visibly trailing the other.
        const evalAfter = await engine.evaluate(fenAfter, ANALYSIS_DEPTH);

        // This is the engine's own data -- never routed through (or paraphrased by)
        // the AI. All 3 candidates are always listed, even one matching the move
        // played -- see formatRankedCandidates for why (it's flagged via isPlayed
        // instead of being torn out and re-analyzed separately under a different search).
        setCandidates(formatRankedCandidates(fenBefore, evalBefore.candidates, playedUci));
        if (!isPlayedCandidate) {
          const forMover = moverPerspective(evalAfter);
          setPlayedScore(formatScore(forMover.scoreCp, forMover.scoreMate));
        }
        setEvals({ before: evalBefore, after: evalAfter });
      } finally {
        engine.terminate();
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleAskAi = () => {
    if (!evals) return;
    const prompt = buildMoveAnalysisPrompt({ fenBefore, moveSan, moverColor, evalBefore: evals.before, evalAfter: evals.after });
    ask(prompt);
  };

  return (
    <div className="move-analysis">
      <button type="button" className="btn btn-sm btn-primary" onClick={handleAnalyze} disabled={isEvaluating || isAsking}>
        {isEvaluating ? 'Evaluating...' : `Analyse ${moveSan}`}
      </button>

      {playedScore && (
        <p className="move-analysis__played">
          <span className="move-analysis__candidate-san">{moveSan} (played)</span>
          <span className="move-analysis__candidate-score">{playedScore}</span>
        </p>
      )}

      {candidates && candidates.length > 0 && (
        <>
          <p className="move-analysis__candidates-label">Engine's top {candidates.length}</p>
          <ul className="move-analysis__candidates">
            {candidates.map((c) => {
              const rest = c.line.slice(c.san.length).trim();
              return (
                <li key={c.san} className={c.isPlayed ? 'move-analysis__candidate--played' : undefined}>
                  <span className="move-analysis__candidate-line">
                    <span className="move-analysis__candidate-san">{c.san}</span>
                    {rest && ` ${rest}`}
                    {c.isPlayed ? ' (played)' : ''}
                  </span>
                  <span className="move-analysis__candidate-score">{c.score}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {evals && (
        <div className="move-analysis__ai-row">
          <button
            type="button"
            className="btn btn-sm btn-outline move-analysis__ai-button"
            onClick={handleAskAi}
            disabled={isAsking || !aiReady}
            title={aiButtonTitle}
          >
            {isAsking ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Asking {providerLabel}...
              </>
            ) : (
              'AI analysis'
            )}
          </button>
          <AiSettings onSaved={() => setAiConfigVersion((v) => v + 1)} />
        </div>
      )}

      <AiResultPanel result={result} error={error} onClose={clear} />
    </div>
  );
}
