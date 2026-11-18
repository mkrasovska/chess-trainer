export type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'Source & Search',
  2: 'Filter & Browse',
  3: 'Analysis',
};

type StepperProps = {
  currentStep: Step;
  // Reachability is derived from whether there's currently something to show on that
  // step (a resolved player+games for step 2, a loaded game for step 3), not from
  // step history -- so a step correctly stops being clickable if its data is cleared.
  step2Reachable: boolean;
  step3Reachable: boolean;
  onSelectStep: (step: Step) => void;
};

export function Stepper({ currentStep, step2Reachable, step3Reachable, onSelectStep }: StepperProps) {
  const reachable: Record<Step, boolean> = { 1: true, 2: step2Reachable, 3: step3Reachable };

  return (
    <div className="stepper">
      {([1, 2, 3] as const).map((step) => (
        <button
          key={step}
          type="button"
          disabled={!reachable[step]}
          className={
            step === currentStep
              ? 'stepper__step stepper__step--active'
              : reachable[step]
                ? 'stepper__step'
                : 'stepper__step stepper__step--disabled'
          }
          onClick={() => onSelectStep(step)}
        >
          {step}. {STEP_LABELS[step]}
        </button>
      ))}
    </div>
  );
}
