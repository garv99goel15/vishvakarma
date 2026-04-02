// ============================================================================
// SettingsPanel — Phase 6: Dashboard Configuration UI
// Configurable polling intervals, alert thresholds, Jira transitions, etc.
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box,
  Typography, TextField, Switch, FormControlLabel, Divider, Alert,
  IconButton, Select, MenuItem, InputLabel, FormControl, LinearProgress,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import RestoreIcon from '@mui/icons-material/Restore';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { fetchSettings, saveSettings, resetAllSettings, sendTestNotification } from '../services/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface SettingsGroup {
  title: string;
  fields: SettingsField[];
}

interface SettingsField {
  key: string;
  label: string;
  type: 'number' | 'text' | 'boolean' | 'select';
  suffix?: string;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
  hint?: string;
}

const SETTINGS_SCHEMA: SettingsGroup[] = [
  {
    title: 'Polling Intervals',
    fields: [
      { key: 'jiraPollInterval', label: 'Jira Poll Interval', type: 'number', suffix: 'ms', min: 10000, max: 600000, hint: 'How often to sync Jira (10s–10min)' },
      { key: 'bitbucketPollInterval', label: 'Bitbucket Poll Interval', type: 'number', suffix: 'ms', min: 10000, max: 600000 },
      { key: 'azdoPollInterval', label: 'AzDO Poll Interval', type: 'number', suffix: 'ms', min: 10000, max: 600000 },
      { key: 'notificationPollInterval', label: 'Alert Scan Interval', type: 'number', suffix: 'ms', min: 30000, max: 600000 },
    ],
  },
  {
    title: 'Alert Thresholds',
    fields: [
      { key: 'stuckCardThresholdHours', label: 'Stuck Card Threshold', type: 'number', suffix: 'hours', min: 1, max: 720, hint: 'Alert when card is in same stage for N hours' },
      { key: 'failedPipelineAlertEnabled', label: 'Alert on Failed Pipelines', type: 'boolean' },
      { key: 'declinedPRAlertEnabled', label: 'Alert on Declined PRs', type: 'boolean' },
    ],
  },
  {
    title: 'Jira Auto-Transitions',
    fields: [
      { key: 'jiraTransitionAfterCD', label: 'After CD Completes', type: 'text', hint: 'Target Jira status after CD pipeline passes' },
      { key: 'jiraTransitionAfterQEPass', label: 'After QE Pass', type: 'text', hint: 'Target Jira status when QE passes' },
      { key: 'jiraTransitionAfterQEFail', label: 'After QE Fail', type: 'text', hint: 'Target Jira status when QE fails' },
    ],
  },
  {
    title: 'Integrations',
    fields: [
      { key: 'teamsWebhookUrl', label: 'Teams Webhook URL', type: 'text', hint: 'Microsoft Teams incoming webhook for critical alerts' },
      { key: 'copilotReviewUrl', label: 'Copilot Review URL', type: 'text', hint: 'GitHub Copilot PR review tool endpoint' },
    ],
  },
  {
    title: 'Display Preferences',
    fields: [
      { key: 'defaultViewMode', label: 'Default View', type: 'select', options: [{ value: 'flat', label: 'Flat List' }, { value: 'swimlane', label: 'Swimlane' }] },
      { key: 'defaultGroupBy', label: 'Default Group By', type: 'select', options: [{ value: 'assignee', label: 'Assignee' }, { value: 'priority', label: 'Priority' }, { value: 'stage', label: 'Stage' }, { value: 'issueType', label: 'Issue Type' }] },
      { key: 'cardsPerPage', label: 'Cards Per Page', type: 'number', min: 10, max: 500 },
      { key: 'autoRefreshInterval', label: 'Auto Refresh', type: 'number', suffix: 'seconds (0=disabled)', min: 0, max: 300 },
    ],
  },
];

const SettingsPanel: React.FC<Props> = ({ open, onClose }) => {
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setSaved(false);
      fetchSettings()
        .then((current) => {
          setValues(current);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open]);

  const handleChange = (key: string, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveSettings(values);
      setValues(result.settings);
      setSaved(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestAlert = async () => {
    setTestSending(true);
    setTestMessage(null);
    setTestError(null);
    try {
      const result = await sendTestNotification({
        severity: 'critical',
        title: 'Manual test alert',
        message: 'Triggered from Settings panel to validate Teams delivery.',
        ticketId: 'TEST-ALERT',
      });
      setTestMessage(result?.note || 'Test alert sent');
    } catch (err: any) {
      setTestError(err?.response?.data?.error || err?.message || 'Failed to send test alert');
    } finally {
      setTestSending(false);
    }
  };

  const handleReset = async () => {
    if (!globalThis.confirm('Reset all settings to defaults?')) return;
    setLoading(true);
    try {
      const result = await resetAllSettings();
      setValues(result.settings);
      setSaved(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { minHeight: '70vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <SettingsIcon sx={{ color: '#0078d4' }} />
        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, fontSize: '1rem' }}>
          Dashboard Settings
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {loading && <LinearProgress />}

      <DialogContent dividers sx={{ pt: 2 }}>
        {saved && <Alert severity="success" sx={{ mb: 2 }}>Settings saved successfully!</Alert>}
        {testMessage && <Alert severity="info" sx={{ mb: 2 }}>{testMessage}</Alert>}
        {testError && <Alert severity="error" sx={{ mb: 2 }}>{testError}</Alert>}

        {SETTINGS_SCHEMA.map((group) => (
          <Box key={group.title} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0078d4', mb: 1.5 }}>
              {group.title}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {group.fields.map((field) => (
                <Box key={field.key}>
                  {field.type === 'boolean' ? (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(values[field.key])}
                          onChange={e => handleChange(field.key, e.target.checked)}
                          size="small"
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                          {field.label}
                        </Typography>
                      }
                    />
                  ) : field.type === 'select' ? (
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel sx={{ fontSize: '0.85rem' }}>{field.label}</InputLabel>
                      <Select
                        value={values[field.key] || ''}
                        onChange={e => handleChange(field.key, e.target.value)}
                        label={field.label}
                        size="small"
                      >
                        {field.options?.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField
                      label={field.label}
                      type={field.type}
                      size="small"
                      value={values[field.key] ?? ''}
                      onChange={e => handleChange(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                      InputProps={{
                        endAdornment: field.suffix ? (
                          <Typography variant="caption" sx={{ color: '#605e5c', ml: 0.5 }}>{field.suffix}</Typography>
                        ) : undefined,
                      }}
                      inputProps={field.type === 'number' ? { min: field.min, max: field.max } : undefined}
                      helperText={field.hint}
                      sx={{ minWidth: 300 }}
                    />
                  )}
                  {field.hint && field.type === 'boolean' && (
                    <Typography variant="caption" sx={{ color: '#605e5c', ml: 4 }}>{field.hint}</Typography>
                  )}
                </Box>
              ))}
            </Box>
            <Divider sx={{ mt: 2 }} />
          </Box>
        ))}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<RestoreIcon />}
            onClick={handleReset}
            color="inherit"
            size="small"
          >
            Reset to Defaults
          </Button>
          <Button
            startIcon={<NotificationsActiveIcon />}
            onClick={handleSendTestAlert}
            color="warning"
            size="small"
            disabled={testSending}
          >
            {testSending ? 'Sending...' : 'Send Test Alert'}
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} size="small">Cancel</Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            size="small"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsPanel;
