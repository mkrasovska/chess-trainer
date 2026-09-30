import { askGemini, listGeminiModels } from './gemini';
import { askGroq, listGroqModels } from './groq';
import type { AiModel } from './types';

export type AiProviderId = 'gemini' | 'groq';

export const AI_PROVIDERS: { id: AiProviderId; label: string }[] = [
  { id: 'gemini', label: 'Gemini' },
  { id: 'groq', label: 'Groq' },
];

const PROVIDER_KEY = 'chess-trainer:ai-provider';
const apiKeyStorageKey = (provider: AiProviderId) => `chess-trainer:ai-api-key:${provider}`;
const modelStorageKey = (provider: AiProviderId) => `chess-trainer:ai-model:${provider}`;

function readStorage(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage failures (private browsing, etc.)
  }
}

export function getAiProvider(): AiProviderId {
  const stored = readStorage(PROVIDER_KEY);
  return stored === 'groq' ? 'groq' : 'gemini';
}

export function setAiProvider(provider: AiProviderId): void {
  writeStorage(PROVIDER_KEY, provider);
}

export function getApiKey(provider: AiProviderId): string {
  return readStorage(apiKeyStorageKey(provider));
}

export function setApiKey(provider: AiProviderId, key: string): void {
  writeStorage(apiKeyStorageKey(provider), key);
}

export function getModel(provider: AiProviderId): string {
  return readStorage(modelStorageKey(provider));
}

export function setModel(provider: AiProviderId, model: string): void {
  writeStorage(modelStorageKey(provider), model);
}

export function listModels(provider: AiProviderId, apiKey: string): Promise<AiModel[]> {
  return provider === 'gemini' ? listGeminiModels(apiKey) : listGroqModels(apiKey);
}

const PROVIDER_LABEL: Record<AiProviderId, string> = { gemini: 'Gemini', groq: 'Groq' };

export async function ask(prompt: string): Promise<string> {
  const provider = getAiProvider();
  const apiKey = getApiKey(provider);
  const model = getModel(provider);

  if (!apiKey) {
    throw new Error(`No ${PROVIDER_LABEL[provider]} API key set. Add one in AI Settings.`);
  }
  if (!model) {
    throw new Error(`No ${PROVIDER_LABEL[provider]} model selected. Pick one in AI Settings.`);
  }

  return provider === 'gemini' ? askGemini(prompt, apiKey, model) : askGroq(prompt, apiKey, model);
}
