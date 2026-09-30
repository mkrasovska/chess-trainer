import { useCallback, useState } from 'react';
import { ask as askProvider } from '../lib/ai/provider';

export function useAiRequest() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async (prompt: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const text = await askProvider(prompt);
      setResult(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI request failed.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { isLoading, result, error, ask, clear };
}
