// ============================================================================
// ExportMenu — Phase 5
// Dropdown menu for exporting sprint data as CSV or JSON.
// ============================================================================

import React, { useState } from 'react';
import {
  IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Tooltip,
  Divider, Typography,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import TableChartIcon from '@mui/icons-material/TableChart';
import DataObjectIcon from '@mui/icons-material/DataObject';
import PrintIcon from '@mui/icons-material/Print';
import { getExportCsvUrl, getExportJsonUrl } from '../services/api';

interface ExportMenuProps {
  sprintId?: number;
  sprintName?: string;
}

const ExportMenu: React.FC<ExportMenuProps> = ({ sprintId, sprintName }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  if (!sprintId) return null;

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handleCsvExport = () => {
    window.open(getExportCsvUrl(sprintId), '_blank');
    handleClose();
  };

  const handleJsonExport = () => {
    window.open(getExportJsonUrl(sprintId), '_blank');
    handleClose();
  };

  const handlePrint = () => {
    handleClose();
    setTimeout(() => window.print(), 200);
  };

  return (
    <>
      <Tooltip title="Export sprint data">
        <IconButton color="inherit" onClick={handleOpen} size="small">
          <FileDownloadIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Typography variant="caption" sx={{ px: 2, py: 0.5, color: '#605e5c', display: 'block' }}>
          Export: {sprintName || `Sprint #${sprintId}`}
        </Typography>
        <Divider />
        <MenuItem onClick={handleCsvExport}>
          <ListItemIcon><TableChartIcon fontSize="small" /></ListItemIcon>
          <ListItemText
            primary="Export as CSV"
            secondary="Spreadsheet-compatible format"
            primaryTypographyProps={{ fontSize: '0.85rem' }}
            secondaryTypographyProps={{ fontSize: '0.7rem' }}
          />
        </MenuItem>
        <MenuItem onClick={handleJsonExport}>
          <ListItemIcon><DataObjectIcon fontSize="small" /></ListItemIcon>
          <ListItemText
            primary="Export as JSON"
            secondary="Full structured data"
            primaryTypographyProps={{ fontSize: '0.85rem' }}
            secondaryTypographyProps={{ fontSize: '0.7rem' }}
          />
        </MenuItem>
        <Divider />
        <MenuItem onClick={handlePrint}>
          <ListItemIcon><PrintIcon fontSize="small" /></ListItemIcon>
          <ListItemText
            primary="Print / Save as PDF"
            secondary="Use browser print dialog"
            primaryTypographyProps={{ fontSize: '0.85rem' }}
            secondaryTypographyProps={{ fontSize: '0.7rem' }}
          />
        </MenuItem>
      </Menu>
    </>
  );
};

export default ExportMenu;
