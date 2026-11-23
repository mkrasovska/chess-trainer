import { Alert, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

type AiResultPanelProps = {
  result: string | null;
  error: string | null;
  onClose: () => void;
};

export function AiResultPanel({ result, error, onClose }: AiResultPanelProps) {
  if (!result && !error) return null;

  return (
    <Alert
      severity={error ? 'error' : 'info'}
      action={
        <IconButton size="small" aria-label="Close" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      }
      sx={{ mt: 1 }}
    >
      {error ?? result}
    </Alert>
  );
}
