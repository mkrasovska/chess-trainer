import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Container, IconButton, Paper, Tab, Tabs, Typography } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { Board, DEFAULT_BOARD_SIZE } from './components/Board';
import { EvalBar } from './components/EvalBar';
import { GameArchiveImport } from './components/GameArchiveImport';
import { GamesTable } from './components/GamesTable';
import { MoveAnalysis } from './components/MoveAnalysis';
import { MoveList } from './components/MoveList';
import { PgnImport } from './components/PgnImport';
import { Stepper, type Step } from './components/Stepper';
import { useChessGame } from './hooks/useChessGame';
import { useGameAnalysis } from './hooks/useGameAnalysis';
import { useStockfish } from './hooks/useStockfish';
import { useViewportWidth } from './hooks/useViewportWidth';
import type { PgnGame } from './lib/pgnUtils';

// 'lichess' removed for now -- LichessImport.tsx is kept but unused, not deleted.
type ImportTab = 'paste' | 'archive';

function uciToArrow(uciMove: string) {
  return {
    startSquare: uciMove.slice(0, 2),
    endSquare: uciMove.slice(2, 4),
    color: 'rgba(0, 128, 0, 0.6)',
  };
}

function App() {
  const {
    moves,
    fens,
    currentPly,
    currentFen,
    previousFen,
    lastMoveSan,
    gameInfo,
    isBranching,
    branchMoves,
    error,
    loadPgn,
    makeMove,
    goToPly,
    goFirst,
    goPrev,
    goNext,
    goLast,
    returnToMainline,
    reset,
  } = useChessGame();

  const { isReady, line, bestMove, evaluate } = useStockfish();
  const gameAnalysis = useGameAnalysis();
  const [importTab, setImportTab] = useState<ImportTab>('paste');
  const [currentStep, setCurrentStep] = useState<Step>(1);

  const handleLoadPgn = (pgn: string) => {
    gameAnalysis.clear();
    loadPgn(pgn);
  };

  // Switching import tabs should drop whatever game/position was loaded, not carry
  // it over to a tab the user is now looking at for a different purpose -- including
  // the resolved games table (and its filters/counters), which otherwise kept
  // showing the previous source's data since nothing else ever cleared it.
  const handleTabChange = (tab: ImportTab) => {
    setImportTab(tab);
    gameAnalysis.clear();
    reset();
    setCurrentStep(1);
    setSourceGames([]);
  };

  const [sourceGames, setSourceGames] = useState<PgnGame[]>([]);

  // What every source funnels into once it has resolved a pool of games -- whose
  // perspective (if any) to view it from is picked later, as a filter inside the
  // games table itself, not here. A single game means there's nothing to browse, so
  // jump straight to it instead (the step-2 advance is handled below, triggered
  // uniformly by a game actually loading, from any path).
  const applyResolvedGames = (games: PgnGame[]) => {
    setSourceGames(games);
    if (games.length === 1) {
      handleLoadPgn(games[0].raw);
    }
  };

  useEffect(() => {
    if (isReady) evaluate(currentFen);
  }, [isReady, currentFen, evaluate]);

  // Advances to step 2 whenever a game actually (successfully) loads, regardless of
  // which path got there (single-game shortcut, or picking a row from the games
  // table) -- and regardless of whether a game was already loaded, so re-picking a
  // different (or even the same) row jumps back to step 2 too. Compared by identity
  // rather than by "is it loaded" so this fires on every successful load, not just
  // the first one; a failed load leaves gameInfo's reference unchanged, so it
  // correctly never fires then, letting the error stay visible on step 1.
  const isGameLoaded = gameInfo !== null;
  const prevGameInfoRef = useRef(gameInfo);
  useEffect(() => {
    if (gameInfo !== null && gameInfo !== prevGameInfoRef.current) setCurrentStep(2);
    prevGameInfoRef.current = gameInfo;
  }, [gameInfo]);

  // Left/right arrow keys step through moves, same as the |< < > >| buttons, but only
  // while step 2 (the board) is actually visible -- otherwise they'd silently move a
  // piece you can't see. goPrev/goNext/currentStep are read through a ref rather than
  // listed as effect deps so one listener stays attached for the component's lifetime
  // instead of detaching/reattaching on every navigation.
  const navRef = useRef({ goPrev, goNext, currentStep });
  navRef.current = { goPrev, goNext, currentStep };
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (navRef.current.currentStep !== 2) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navRef.current.goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navRef.current.goNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sideToMove = (currentFen.split(' ')[1] === 'b' ? 'b' : 'w') as 'w' | 'b';
  const arrows = useMemo(() => (bestMove ? [uciToArrow(bestMove)] : []), [bestMove]);

  // react-chessboard measures its own rendered pixel size (ResizeObserver) and expects
  // a definite width/height -- sizing it purely through CSS (aspect-ratio etc.) previously
  // broke its internal grid rendering. Computing a real pixel size from the viewport here
  // keeps Board's literal-pixel-size contract intact while still shrinking it to fit next
  // to the eval bar on a narrow screen, instead of letting the row wrap.
  const BOARD_ROW_CHROME = 96; // side padding + eval bar + gap + safety margin
  const viewportWidth = useViewportWidth();
  const boardSize = Math.max(200, Math.min(DEFAULT_BOARD_SIZE, viewportWidth - BOARD_ROW_CHROME));

  const step2Reachable = isGameLoaded;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Box component="img" src={`${import.meta.env.BASE_URL}logo.png`} alt="" sx={{ height: 56 }} />
        <Typography variant="h1" sx={visuallyHidden}>
          ChessPoint
        </Typography>
      </Box>

      <Stepper currentStep={currentStep} step2Reachable={step2Reachable} onSelectStep={setCurrentStep} />

      <Box sx={{ display: currentStep === 1 ? undefined : 'none' }}>
        <Tabs value={importTab} onChange={(_e, value) => handleTabChange(value)} sx={{ mb: 2 }}>
          <Tab label="Paste PGN" value="paste" />
          <Tab label="Download PGN" value="archive" />
        </Tabs>

        {importTab === 'paste' && <PgnImport onLoad={handleLoadPgn} onGamesResolved={applyResolvedGames} error={error} />}
        {importTab === 'archive' && <GameArchiveImport onGamesLoaded={applyResolvedGames} />}

        {sourceGames.length > 1 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, mt: 2 }}>
            <GamesTable games={sourceGames} onSelectGame={handleLoadPgn} />
          </Box>
        )}
      </Box>

      <Box sx={{ display: currentStep === 2 ? undefined : 'none' }}>
        <Paper variant="outlined" sx={{ p: 2, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <EvalBar
              scoreCp={line?.scoreCp ?? null}
              scoreMate={line?.scoreMate ?? null}
              sideToMove={sideToMove}
              depth={line?.depth ?? null}
              trackHeight={boardSize}
            />
            <Box sx={{ minWidth: 0 }}>
              {gameInfo && (
                <Typography variant="body2" sx={{ mb: 0.75, fontWeight: 600 }}>
                  {gameInfo.white} vs {gameInfo.black}
                  {gameInfo.year !== null && ` (${gameInfo.year})`}
                </Typography>
              )}
              <Board fen={currentFen} onMove={makeMove} arrows={arrows} size={boardSize} />
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                <IconButton size="small" onClick={goFirst} disabled={isBranching}>
                  <SkipPreviousIcon />
                </IconButton>
                <IconButton size="small" onClick={goPrev}>
                  <NavigateBeforeIcon />
                </IconButton>
                <IconButton size="small" onClick={goNext} disabled={isBranching}>
                  <NavigateNextIcon />
                </IconButton>
                <IconButton size="small" onClick={goLast} disabled={isBranching}>
                  <SkipNextIcon />
                </IconButton>
              </Box>
              {isBranching && (
                <Alert
                  severity="info"
                  sx={{ mt: 1.5 }}
                  action={
                    <Button color="inherit" size="small" onClick={returnToMainline}>
                      ← back to game
                    </Button>
                  }
                >
                  Exploring a different line{branchMoves.length > 0 && `: ${branchMoves.map((m) => m.san).join(' ')}`}
                </Alert>
              )}
              {lastMoveSan && previousFen && (
                <MoveAnalysis
                  key={`${previousFen}|${currentFen}`}
                  fenBefore={previousFen}
                  fenAfter={currentFen}
                  moveSan={lastMoveSan}
                  moverColor={previousFen.split(' ')[1] === 'b' ? 'b' : 'w'}
                />
              )}
            </Box>
          </Box>
          <Box sx={{ flex: '1 1 260px', minWidth: 260, textAlign: 'left' }}>
            {moves.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                {!gameAnalysis.isAnalyzing && (
                  <Button variant="contained" size="small" onClick={() => gameAnalysis.analyze(fens)}>
                    Analyze game
                  </Button>
                )}
                {gameAnalysis.isAnalyzing && (
                  <>
                    <Typography variant="body2">Analyzing... {Math.round(gameAnalysis.progress * 100)}%</Typography>
                    <Button size="small" onClick={gameAnalysis.cancel}>
                      Cancel
                    </Button>
                  </>
                )}
              </Box>
            )}

            <MoveList moves={moves} currentPly={currentPly} onSelectPly={goToPly} classifications={gameAnalysis.classifications} />
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}

export default App;
