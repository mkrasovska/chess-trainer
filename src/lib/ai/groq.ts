import type { AiModel } from './types';

// Groq's models endpoint lists audio (speech-to-text/TTS) models alongside chat
// models; those can't answer a text prompt, so filter them out of the dropdown.
const NON_CHAT_PATTERN = /whisper|tts/i;

export async function listGroqModels(apiKey: string): Promise<AiModel[]> {
  const response = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Could not list Groq models (${response.status}).`);
  }
  const data = await response.json();
  const models: unknown[] = data?.data ?? [];
  return models
    .filter(
      (model): model is { id: string } =>
        typeof model === 'object' && model !== null && typeof (model as { id?: unknown }).id === 'string',
    )
    .map((model) => ({ id: model.id, label: model.id }))
    .filter((model) => !NON_CHAT_PATTERN.test(model.id))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function askGroq(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Groq request failed (${response.status}).`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Groq returned an empty response.');
  }
  return text.trim();
}
