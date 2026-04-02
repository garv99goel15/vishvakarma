import React from 'react';
import { Box, Typography } from '@mui/material';

interface Props {
  title: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

class ChartErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ mx: 3, mt: 1, p: 2, border: '1px solid #edebe9', borderRadius: 1, color: 'text.secondary' }}>
          <Typography variant="caption">{this.props.title}: unable to render chart</Typography>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default ChartErrorBoundary;
