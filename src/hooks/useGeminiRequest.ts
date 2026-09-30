import { useCallback, useState } from 'react';
import { askGemini } from '../lib/gemini';

export function useGeminiRequest() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async (prompt: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const text = await askGemini(prompt);
      setResult(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gemini request failed.');
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
