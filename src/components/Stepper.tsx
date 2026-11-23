import { Step as MuiStep, StepButton, Stepper as MuiStepper } from '@mui/material';

export type Step = 1 | 2;

const STEP_LABELS: Record<Step, string> = {
  1: 'Source',
  2: 'Analysis',
};

type StepperProps = {
  currentStep: Step;
  // Reachability is derived from whether there's currently something to show on that
  // step (a loaded game for step 2), not from step history -- so it correctly stops
  // being clickable if that data is cleared.
  step2Reachable: boolean;
  onSelectStep: (step: Step) => void;
};

export function Stepper({ currentStep, step2Reachable, onSelectStep }: StepperProps) {
  const reachable: Record<Step, boolean> = { 1: true, 2: step2Reachable };

  return (
    <MuiStepper nonLinear activeStep={currentStep - 1} sx={{ my: 4 }}>
      {([1, 2] as const).map((step) => (
        <MuiStep key={step} completed={step < currentStep}>
          <StepButton disabled={!reachable[step]} onClick={() => onSelectStep(step)}>
            {STEP_LABELS[step]}
          </StepButton>
        </MuiStep>
      ))}
    </MuiStepper>
  );
}
