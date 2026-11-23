import { useEffect, useState } from 'react';
import { Box, Button, Collapse, Link, MenuItem, Paper, TextField, Typography } from '@mui/material';
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

type AiSettingsProps = {
  // Called after Save -- lets a caller showing an AI-gated control (e.g. the "AI
  // analysis" button) know its enabled/disabled state may need recomputing.
  onSaved?: () => void;
};

export function AiSettings({ onSaved }: AiSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [provider, setProviderState] = useState<AiProviderId>(getAiProvider());
  const [apiKey, setApiKeyState] = useState(() => getApiKey(provider));
  const [models, setModels] = useState<AiModel[] | null>(null);
  const [selectedModel, setSelectedModel] = useState(() => getModel(provider));
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

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
    setIsOpen(false);
    onSaved?.();
  };

  useEffect(() => {
    if (isOpen && apiKey && !models && !isFetchingModels && !fetchError) {
      fetchModels(provider, apiKey);
    }
    // Only re-run when the panel opens -- fetchModels/apiKey changes are handled explicitly elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <Box sx={{ position: 'relative' }}>
      <Button size="small" onClick={() => setIsOpen((open) => !open)}>
        AI settings {isOpen ? '▲' : '▼'}
      </Button>
      <Collapse in={isOpen}>
        <Paper
          variant="outlined"
          sx={{
            position: 'absolute',
            right: 0,
            top: '100%',
            zIndex: 10,
            mt: 0.5,
            p: 2,
            width: 280,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          <TextField
            select
            label="Provider"
            size="small"
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as AiProviderId)}
          >
            {AI_PROVIDERS.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            type="password"
            label={`${providerLabel} API key`}
            size="small"
            value={apiKey}
            onChange={(e) => {
              setApiKeyState(e.target.value);
              setModels(null);
              setFetchError(null);
            }}
            onBlur={() => fetchModels(provider, apiKey)}
            placeholder={`Paste your ${providerLabel} API key...`}
          />

          {isFetchingModels && <Typography variant="body2">Loading available models...</Typography>}
          {fetchError && (
            <Typography variant="body2" color="error">
              {fetchError}
            </Typography>
          )}

          {models && models.length > 0 && (
            <TextField select label="Model" size="small" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
              {models.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
          )}

          {!models && !isFetchingModels && (
            <Button size="small" onClick={() => fetchModels(provider, apiKey)} disabled={!apiKey.trim()}>
              Load models
            </Button>
          )}

          <Typography variant="body2" color="text.secondary">
            {provider === 'gemini' ? (
              <>
                Get a free key at{' '}
                <Link href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                  aistudio.google.com/apikey
                </Link>
                .
              </>
            ) : (
              <>
                Get a free key at{' '}
                <Link href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
                  console.groq.com/keys
                </Link>
                .
              </>
            )}{' '}
            Stored only in this browser, never sent anywhere but the provider's API.
          </Typography>

          <Button variant="contained" size="small" onClick={handleSave} disabled={!selectedModel}>
            Save
          </Button>
        </Paper>
      </Collapse>
    </Box>
  );
}
