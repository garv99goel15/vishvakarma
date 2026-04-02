// ============================================================================
// AddCardDialog — Add a Jira ticket to the current sprint
// ============================================================================

import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Typography,
} from '@mui/material';
import { addCard } from '../services/api';

interface AddCardDialogProps {
  open: boolean;
  sprintId: number;
  onClose: () => void;
  onAdded: () => void;
}

const AddCardDialog: React.FC<AddCardDialogProps> = ({ open, sprintId, onClose, onAdded }) => {
  const [ticketId, setTicketId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!ticketId.trim()) return;
    setLoading(true);
    setError('');
    try {
      await addCard(ticketId.trim().toUpperCase(), sprintId);
      setTicketId('');
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>Add Card to Sprint</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Jira Ticket ID"
          placeholder="e.g. GET-6481"
          value={ticketId}
          onChange={(e) => setTicketId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          sx={{ mt: 1 }}
          size="small"
        />
        {error && (
          <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small">Cancel</Button>
        <Button onClick={handleAdd} variant="contained" size="small" disabled={loading || !ticketId.trim()}>
          {loading ? 'Adding...' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddCardDialog;
