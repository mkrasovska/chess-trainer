import { useState } from 'react';
import { DEFAULT_GEMINI_MODEL, getGeminiApiKey, getGeminiModel, setGeminiApiKey, setGeminiModel } from '../lib/gemini';

export function AiSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(getGeminiApiKey());
  const [model, setModel] = useState(getGeminiModel());
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setGeminiApiKey(apiKey.trim());
    setGeminiModel(model.trim() || DEFAULT_GEMINI_MODEL);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="ai-settings">
      <button type="button" className="ai-settings__toggle" onClick={() => setIsOpen((open) => !open)}>
        AI settings {isOpen ? '▲' : '▼'}
      </button>
      {isOpen && (
        <div className="ai-settings__panel">
          <label>
            Gemini API key
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your Gemini API key..."
            />
          </label>
          <label>
            Model
            <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder={DEFAULT_GEMINI_MODEL} />
          </label>
          <p className="ai-settings__hint">
            Get a free key at{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              aistudio.google.com/apikey
            </a>
            . Stored only in this browser (localStorage), never sent anywhere but Google's API.
          </p>
          <button type="button" onClick={handleSave}>
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
