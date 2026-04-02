// ============================================================================
// NotificationBell — Phase 5
// In-app notification bell with dropdown panel showing alerts.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  IconButton, Badge, Popover, Box, Typography, List, ListItem,
  ListItemText, ListItemIcon, Chip, Button, Divider, Tooltip,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import {
  fetchNotifications, fetchNotificationCount,
  markNotificationRead, markAllRead, dismissAllNotifications,
} from '../services/api';

interface NotificationBellProps {
  pollIntervalMs?: number;
}

const SEVERITY_CONFIG: Record<string, { icon: React.ReactElement; color: string }> = {
  critical: { icon: <ErrorIcon fontSize="small" />, color: '#d13438' },
  error: { icon: <ErrorIcon fontSize="small" />, color: '#d13438' },
  warning: { icon: <WarningAmberIcon fontSize="small" />, color: '#ca5010' },
  info: { icon: <InfoIcon fontSize="small" />, color: '#0078d4' },
};

const NotificationBell: React.FC<NotificationBellProps> = ({ pollIntervalMs = 30_000 }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshCount = useCallback(async () => {
    try {
      const count = await fetchNotificationCount();
      setUnreadCount(count);
    } catch { /* ignore */ }
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const list = await fetchNotifications(false, 30);
      setNotifications(list);
      await refreshCount();
    } catch { /* ignore */ }
  }, [refreshCount]);

  // Poll for unread count
  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, pollIntervalMs);
    return () => clearInterval(interval);
  }, [refreshCount, pollIntervalMs]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    refreshList();
  };

  const handleClose = () => setAnchorEl(null);

  const handleMarkAllRead = async () => {
    await markAllRead();
    refreshList();
  };

  const handleDismissAll = async () => {
    await dismissAllNotifications();
    refreshList();
  };

  const handleClickNotification = async (n: any) => {
    if (!n.read) {
      await markNotificationRead(n.id);
      refreshList();
    }
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton color="inherit" onClick={handleOpen} size="small">
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 400, maxHeight: 480 } } }}
      >
        <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #edebe9' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Notifications {unreadCount > 0 && <Chip label={unreadCount} size="small" color="error" sx={{ ml: 1, height: 20 }} />}
          </Typography>
          <Box>
            <Tooltip title="Mark all read">
              <IconButton size="small" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
                <DoneAllIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Dismiss all">
              <IconButton size="small" onClick={handleDismissAll} disabled={notifications.length === 0}>
                <DeleteSweepIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {notifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <NotificationsIcon sx={{ fontSize: 40, color: '#d2d0ce', mb: 1 }} />
            <Typography variant="body2" sx={{ color: '#a19f9d' }}>
              No notifications
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ maxHeight: 380, overflow: 'auto', p: 0 }}>
            {notifications.map((n: any) => {
              const cfg = SEVERITY_CONFIG[n.severity] || SEVERITY_CONFIG.info;
              return (
                <React.Fragment key={n.id}>
                  <ListItem
                    onClick={() => handleClickNotification(n)}
                    sx={{
                      cursor: 'pointer',
                      backgroundColor: n.read ? 'transparent' : '#f3f2f1',
                      '&:hover': { backgroundColor: '#edebe9' },
                      py: 0.75,
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32, color: cfg.color }}>
                      {cfg.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: n.read ? 400 : 600, fontSize: '0.8rem' }}>
                            {n.title}
                          </Typography>
                          <Chip
                            label={n.severity}
                            size="small"
                            sx={{
                              height: 16, fontSize: '0.6rem',
                              backgroundColor: cfg.color, color: '#fff',
                            }}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" sx={{ color: '#605e5c', display: 'block' }}>
                            {n.message}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#a19f9d', fontSize: '0.65rem' }}>
                            {new Date(n.created_at).toLocaleString()}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  <Divider component="li" />
                </React.Fragment>
              );
            })}
          </List>
        )}

        {notifications.length > 0 && (
          <Box sx={{ p: 1, borderTop: '1px solid #edebe9', textAlign: 'center' }}>
            <Button size="small" onClick={handleDismissAll}>
              Clear all
            </Button>
          </Box>
        )}
      </Popover>
    </>
  );
};

export default NotificationBell;
