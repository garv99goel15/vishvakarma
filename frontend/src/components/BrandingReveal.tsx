// ============================================================================
// BrandingReveal — Dashboard branding component
// Displays: Generative Agile Release Velocity
// ============================================================================

import React from 'react';
import { Typography, Box } from '@mui/material';

interface BrandingRevealProps {
  variant?: 'h6' | 'h5' | 'h4' | 'subtitle1' | 'body1';
  sx?: any;
}

export const BrandingReveal: React.FC<BrandingRevealProps> = ({ variant = 'h6', sx }) => {
  const displayTitle = 'Generative Agile Release Velocity';

  return (
    <Box
      sx={{
        transition: 'all 0.3s ease',
        ...sx,
      }}
    >
      <Typography
        variant={variant}
        sx={{
          fontWeight: 700,
          fontSize: variant === 'h6' ? '0.95rem' : undefined,
          transition: 'all 0.3s ease',
        }}
      >
        {displayTitle}
      </Typography>
    </Box>
  );
};

export default BrandingReveal;
