import type { AiModel } from './types';

type GeminiModelEntry = {
  name?: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
};

export async function listGeminiModels(apiKey: string): Promise<AiModel[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Could not list Gemini models (${response.status}).`);
  }
  const data = await response.json();
  const models: GeminiModelEntry[] = data?.models ?? [];
  return models
    .filter((model) => typeof model.name === 'string' && model.supportedGenerationMethods?.includes('generateContent'))
    .map((model) => {
      const id = model.name!.replace(/^models\//, '');
      return { id, label: model.displayName ?? id };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function askGemini(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Gemini request failed (${response.status}).`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Gemini returned an empty response.');
  }
  return text.trim();
}
