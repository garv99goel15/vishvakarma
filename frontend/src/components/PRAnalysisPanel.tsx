// ============================================================================
// PR Analysis Panel — Display test coverage and code quality metrics
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Card, CardHeader, CardContent, CardActions,
  Box, Grid, Typography, Chip, LinearProgress, Alert, Divider,
  Collapse, IconButton, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Paper, Stack,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { fetchLatestPRAnalysis } from '../services/api';

interface CodeReviewIssue {
  severity: 'critical' | 'major' | 'minor';
  issue: string;
  file?: string;
  line?: number;
  recommendation?: string;
}

interface PRAnalysis {
  id?: number;
  card_id: number;
  pr_id: number;
  repo?: string;
  unit_test_coverage: number;
  functional_test_coverage: number;
  security_status: 'pass' | 'warning' | 'fail' | 'unknown';
  critical_issues: number;
  major_issues: number;
  minor_issues: number;
  production_readiness_score: number;
  summary?: string;
  code_review_issues: CodeReviewIssue[];
  files_changed: any[];
  created_at?: string;
  updated_at?: string;
}

interface PRAnalysisPanelProps {
  cardId: number;
  prId?: number;
}

const PRAnalysisPanel: React.FC<PRAnalysisPanelProps> = ({ cardId, prId }) => {
  const [analysis, setAnalysis] = useState<PRAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        setLoading(true);
        const result = await fetchLatestPRAnalysis(cardId);
        setAnalysis(result.analysis || null);
        setError(null);
      } catch (err: any) {
        setError(err.message);
        setAnalysis(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [cardId]);

  if (loading) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardHeader title="PR Analysis" />
        <CardContent sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardHeader title="PR Analysis" />
        <CardContent>
          <Alert severity="info">
            No PR analysis results available. Run the PR analysis tool to generate test coverage and code quality metrics.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardHeader title="PR Analysis" />
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#4caf50'; // green
    if (score >= 60) return '#ff9800'; // orange
    return '#f44336'; // red
  };

  const getSecurityIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckIcon sx={{ color: 'green' }} />;
      case 'warning':
        return <WarningIcon sx={{ color: 'orange' }} />;
      case 'fail':
        return <CloseIcon sx={{ color: 'red' }} />;
      default:
        return <InfoIcon sx={{ color: 'gray' }} />;
    }
  };

  const issueCount =
    (analysis.critical_issues || 0) +
    (analysis.major_issues || 0) +
    (analysis.minor_issues || 0);

  const hasFailures = analysis.critical_issues > 0 || analysis.major_issues > 0;

  return (
    <Card sx={{ mb: 2, border: hasFailures ? '2px solid #f44336' : 'none' }}>
      <CardHeader
        title="PR Analysis Results"
        subheader={
          analysis.created_at
            ? new Date(analysis.created_at).toLocaleString()
            : 'Unknown date'
        }
        action={
          <IconButton
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label="show more"
          >
            <ExpandMoreIcon
              sx={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s',
              }}
            />
          </IconButton>
        }
      />

      {/* Summary Row */}
      <CardContent sx={{ pb: 1 }}>
        <Grid container spacing={2}>
          {/* Production Readiness Score */}
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{ mb: 1, position: 'relative', display: 'inline-flex' }}>
                <CircularProgress
                  variant="determinate"
                  value={Math.min(100, analysis.production_readiness_score)}
                  size={80}
                  sx={{
                    color: getScoreColor(analysis.production_readiness_score),
                  }}
                />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="h6" component="div" color="textSecondary">
                    {Math.round(analysis.production_readiness_score)}%
                  </Typography>
                </Box>
              </Box>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Production Readiness
              </Typography>
            </Box>
          </Grid>

          {/* Unit Test Coverage */}
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Unit Test Coverage
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={analysis.unit_test_coverage}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                    }}
                  />
                </Box>
                <Typography variant="body2" sx={{ minWidth: 40 }}>
                  {Math.round(analysis.unit_test_coverage)}%
                </Typography>
              </Box>
              <Chip
                label={
                  analysis.unit_test_coverage >= 80
                    ? 'Excellent'
                    : analysis.unit_test_coverage >= 60
                      ? 'Good'
                      : 'Needs Work'
                }
                size="small"
                color={
                  analysis.unit_test_coverage >= 80
                    ? 'success'
                    : analysis.unit_test_coverage >= 60
                      ? 'warning'
                      : 'error'
                }
              />
            </Box>
          </Grid>

          {/* Functional Test Coverage */}
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Functional Test Coverage
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={analysis.functional_test_coverage}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                    }}
                  />
                </Box>
                <Typography variant="body2" sx={{ minWidth: 40 }}>
                  {Math.round(analysis.functional_test_coverage)}%
                </Typography>
              </Box>
              <Chip
                label={
                  analysis.functional_test_coverage >= 70
                    ? 'Complete'
                    : analysis.functional_test_coverage >= 50
                      ? 'Partial'
                      : 'Incomplete'
                }
                size="small"
                color={
                  analysis.functional_test_coverage >= 70
                    ? 'success'
                    : analysis.functional_test_coverage >= 50
                      ? 'warning'
                      : 'error'
                }
              />
            </Box>
          </Grid>

          {/* Security Status */}
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Security Analysis
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getSecurityIcon(analysis.security_status)}
                <Chip
                  label={
                    analysis.security_status.charAt(0).toUpperCase() +
                    analysis.security_status.slice(1)
                  }
                  color={
                    analysis.security_status === 'pass'
                      ? 'success'
                      : analysis.security_status === 'warning'
                        ? 'warning'
                        : 'error'
                  }
                  size="small"
                />
              </Box>
            </Box>
          </Grid>
        </Grid>

        {/* Code Review Issues Summary */}
        {issueCount > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Code Review Issues Found
              </Typography>
              <Stack direction="row" spacing={1}>
                {analysis.critical_issues > 0 && (
                  <Chip
                    icon={<CloseIcon />}
                    label={`${analysis.critical_issues} Critical`}
                    color="error"
                    variant="outlined"
                  />
                )}
                {analysis.major_issues > 0 && (
                  <Chip
                    icon={<WarningIcon />}
                    label={`${analysis.major_issues} Major`}
                    color="warning"
                    variant="outlined"
                  />
                )}
                {analysis.minor_issues > 0 && (
                  <Chip
                    icon={<InfoIcon />}
                    label={`${analysis.minor_issues} Minor`}
                    color="info"
                    variant="outlined"
                  />
                )}
              </Stack>
            </Box>
          </>
        )}

        {/* Summary Comment */}
        {analysis.summary && (
          <>
            <Divider sx={{ my: 2 }} />
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">{analysis.summary}</Typography>
            </Alert>
          </>
        )}
      </CardContent>

      {/* Expandable Details */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider />
        <CardContent>
          {/* Code Review Issues */}
          {analysis.code_review_issues && analysis.code_review_issues.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Code Review Details
              </Typography>
              <TableContainer component={Paper} sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableCell>Severity</TableCell>
                      <TableCell>Issue</TableCell>
                      <TableCell>File</TableCell>
                      <TableCell>Recommendation</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysis.code_review_issues.map((issue, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Chip
                            label={issue.severity}
                            size="small"
                            color={
                              issue.severity === 'critical'
                                ? 'error'
                                : issue.severity === 'major'
                                  ? 'warning'
                                  : 'info'
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{issue.issue}</Typography>
                        </TableCell>
                        <TableCell>
                          {issue.file && (
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                              {issue.file}
                              {issue.line && `:${issue.line}`}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {issue.recommendation && (
                            <Typography variant="caption">{issue.recommendation}</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Files Changed */}
          {analysis.files_changed && analysis.files_changed.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Files Modified ({analysis.files_changed.length})
              </Typography>
              <Box
                sx={{
                  maxHeight: 300,
                  overflow: 'auto',
                  backgroundColor: '#f5f5f5',
                  p: 1.5,
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                }}
              >
                {analysis.files_changed.map((file, idx) => (
                  <Box key={idx} sx={{ mb: 0.5 }}>
                    {typeof file === 'string' ? (
                      file
                    ) : (
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 500 }}>
                          {file.name || file.path}
                        </Typography>
                        {file.additions && (
                          <Typography variant="caption" sx={{ color: 'green', ml: 1 }}>
                            +{file.additions}
                          </Typography>
                        )}
                        {file.deletions && (
                          <Typography variant="caption" sx={{ color: 'red', ml: 0.5 }}>
                            -{file.deletions}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </CardContent>
      </Collapse>

      <Divider />
      <CardActions>
        <Button size="small" disabled>
          Last Updated:{' '}
          {analysis.updated_at
            ? new Date(analysis.updated_at).toLocaleDateString()
            : 'N/A'}
        </Button>
      </CardActions>
    </Card>
  );
};

export default PRAnalysisPanel;
