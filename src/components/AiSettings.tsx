import { useEffect, useState } from 'react';
import {
  AI_PROVIDERS,
  getAiProvider,
  getApiKey,
  getModel,
  listModels,
  setAiProvider,
  setApiKey,
  setModel,
  type AiProviderId,
} from '../lib/ai/provider';
import type { AiModel } from '../lib/ai/types';

export function AiSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const [provider, setProviderState] = useState<AiProviderId>(getAiProvider());
  const [apiKey, setApiKeyState] = useState(() => getApiKey(provider));
  const [models, setModels] = useState<AiModel[] | null>(null);
  const [selectedModel, setSelectedModel] = useState(() => getModel(provider));
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const providerLabel = AI_PROVIDERS.find((p) => p.id === provider)?.label ?? '';

  const fetchModels = async (targetProvider: AiProviderId, key: string) => {
    if (!key.trim()) return;
    setIsFetchingModels(true);
    setFetchError(null);
    try {
      const fetched = await listModels(targetProvider, key.trim());
      setModels(fetched);
      setSelectedModel((current) => {
        if (fetched.some((m) => m.id === current)) return current;
        const savedModel = getModel(targetProvider);
        if (fetched.some((m) => m.id === savedModel)) return savedModel;
        return fetched[0]?.id ?? '';
      });
    } catch (err) {
      setModels(null);
      setFetchError(err instanceof Error ? err.message : 'Could not load models.');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleProviderChange = (next: AiProviderId) => {
    setProviderState(next);
    const key = getApiKey(next);
    setApiKeyState(key);
    setSelectedModel(getModel(next));
    setModels(null);
    setFetchError(null);
    if (key) fetchModels(next, key);
  };

  const handleSave = () => {
    setAiProvider(provider);
    setApiKey(provider, apiKey.trim());
    setModel(provider, selectedModel);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  useEffect(() => {
    if (isOpen && apiKey && !models && !isFetchingModels && !fetchError) {
      fetchModels(provider, apiKey);
    }
    // Only re-run when the panel opens -- fetchModels/apiKey changes are handled explicitly elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <div className="ai-settings">
      <button type="button" className="ai-settings__toggle" onClick={() => setIsOpen((open) => !open)}>
        AI settings {isOpen ? '▲' : '▼'}
      </button>
      {isOpen && (
        <div className="ai-settings__panel">
          <label>
            Provider
            <select value={provider} onChange={(e) => handleProviderChange(e.target.value as AiProviderId)}>
              {AI_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            {providerLabel} API key
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKeyState(e.target.value);
                setModels(null);
                setFetchError(null);
              }}
              onBlur={() => fetchModels(provider, apiKey)}
              placeholder={`Paste your ${providerLabel} API key...`}
            />
          </label>

          {isFetchingModels && <p className="ai-settings__hint">Loading available models...</p>}
          {fetchError && <p className="ai-settings__error">{fetchError}</p>}

          {models && models.length > 0 && (
            <label>
              Model
              <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!models && !isFetchingModels && (
            <button type="button" onClick={() => fetchModels(provider, apiKey)} disabled={!apiKey.trim()}>
              Load models
            </button>
          )}

          <p className="ai-settings__hint">
            {provider === 'gemini' ? (
              <>
                Get a free key at{' '}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                  aistudio.google.com/apikey
                </a>
                .
              </>
            ) : (
              <>
                Get a free key at{' '}
                <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
                  console.groq.com/keys
                </a>
                .
              </>
            )}{' '}
            Stored only in this browser, never sent anywhere but the provider's API.
          </p>

          <button type="button" onClick={handleSave} disabled={!selectedModel}>
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
