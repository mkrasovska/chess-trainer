type AiResultPanelProps = {
  result: string | null;
  error: string | null;
  onClose: () => void;
};

export function AiResultPanel({ result, error, onClose }: AiResultPanelProps) {
  if (!result && !error) return null;

  return (
    <div className={error ? 'ai-result ai-result--error' : 'ai-result'}>
      <button type="button" className="btn btn-xs btn-circle btn-ghost ai-result__close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <p>{error ?? result}</p>
    </div>
  );
}
