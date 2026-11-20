export type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'Source',
  2: 'Filter',
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

  // DaisyUI colors a step (and the connecting line before it) via step-primary,
  // so every step up through the current one gets it, not just the current one.
  return (
    <ul className="steps steps-horizontal w-full my-4">
      {([1, 2, 3] as const).map((step) => (
        <li
          key={step}
          className={`step ${step <= currentStep ? 'step-primary' : ''} ${
            reachable[step] ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
          }`}
          onClick={() => reachable[step] && onSelectStep(step)}
        >
          {STEP_LABELS[step]}
        </li>
      ))}
    </ul>
  );
}
