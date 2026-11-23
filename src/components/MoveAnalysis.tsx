import { useMemo, useState } from 'react';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useAiRequest } from '../hooks/useAiRequest';
import { AiResultPanel } from './AiResultPanel';
import { AiSettings } from './AiSettings';
import { createAnalysisEngine, type PositionEval } from '../lib/analysisEngine';
import { AI_PROVIDERS, getAiProvider, getModel, isAiConfigured } from '../lib/ai/provider';
import { formatRankedCandidates, formatScore, moverPerspective, sanToUci, type RankedCandidate } from '../lib/evalFormat';
import { buildMoveAnalysisPrompt } from '../lib/moveAnalysisPrompt';

// Deeper than the full-game batch analysis depth (16) -- this is 1-2 searches on
// demand for a move the user specifically wants to understand, so it's worth the
// extra time for a score/best-move that's actually converged, especially in sharp
// tactical or endgame positions where shallower search can misjudge severity. 20
// rather than 24: benchmarked against the actual engine across several representative
// positions and found the same best move/line and scores within ~0.1 pawns either
// way, for roughly 2-4x less time depending on position complexity.
const ANALYSIS_DEPTH = 20;
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
      // Two independent positions -- one engine per search, run concurrently, instead
      // of searching fenBefore then fenAfter one after another on a single engine.
      const [engineBefore, engineAfter] = await Promise.all([createAnalysisEngine(), createAnalysisEngine()]);
      try {
        const [evalBefore, evalAfter] = await Promise.all([
          engineBefore.evaluate(fenBefore, ANALYSIS_DEPTH, CANDIDATE_COUNT),
          engineAfter.evaluate(fenAfter, ANALYSIS_DEPTH),
        ]);
        const playedUci = sanToUci(fenBefore, moveSan);
        const isPlayedCandidate = evalBefore.candidates.some((c) => c.moveUci === playedUci);

        // This is the engine's own data -- never routed through (or paraphrased by)
        // the AI. All 3 candidates are always listed, even one matching the move
        // played -- see formatRankedCandidates for why (it's flagged via isPlayed
        // instead of being torn out and re-analyzed separately under a different search).
        setCandidates(formatRankedCandidates(fenBefore, evalBefore.candidates, playedUci));
        // Only needed when the move ISN'T one of the candidates above -- otherwise its
        // score is already shown there, and this fresh search could disagree with it.
        if (!isPlayedCandidate) {
          const forMover = moverPerspective(evalAfter);
          setPlayedScore(formatScore(forMover.scoreCp, forMover.scoreMate));
        }
        setEvals({ before: evalBefore, after: evalAfter });
      } finally {
        engineBefore.terminate();
        engineAfter.terminate();
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
    <>
      <Button
        variant="contained"
        size="small"
        onClick={handleAnalyze}
        disabled={isEvaluating || isAsking}
        sx={{ mt: 1.5 }}
      >
        {isEvaluating ? 'Evaluating...' : `Analyse ${moveSan}`}
      </Button>

      <Box sx={{ mt: 1.5 }}>
        {playedScore && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 1,
              mt: 1,
              pl: 0,
              pr: 1,
              py: 0.5,
              borderRadius: 1,
              bgcolor: 'action.selected',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {moveSan} (played)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {playedScore}
            </Typography>
          </Box>
        )}

        {candidates && candidates.length > 0 && (
          <>
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Engine's top {candidates.length}
            </Typography>
            <Stack spacing={0.25}>
              {candidates.map((c) => {
                const rest = c.line.slice(c.san.length).trim();
                return (
                  <Box
                    key={c.san}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 1,
                      pl: 0,
                      pr: 1,
                      py: 0.25,
                      borderRadius: 1,
                      bgcolor: c.isPlayed ? 'action.selected' : undefined,
                    }}
                  >
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      <Box component="span" sx={{ fontWeight: 700 }}>
                        {c.san}
                      </Box>
                      {rest && ` ${rest}`}
                      {c.isPlayed ? ' (played)' : ''}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {c.score}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </>
        )}

        {evals && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleAskAi}
              disabled={isAsking || !aiReady}
              title={aiButtonTitle}
              startIcon={isAsking ? <CircularProgress size={14} /> : undefined}
            >
              {isAsking ? `Asking ${providerLabel}...` : 'AI analysis'}
            </Button>
            <AiSettings onSaved={() => setAiConfigVersion((v) => v + 1)} />
          </Box>
        )}

        <AiResultPanel result={result} error={error} onClose={clear} />
      </Box>
    </>
  );
}
