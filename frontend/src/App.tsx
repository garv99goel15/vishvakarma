// ============================================================================
// App — Sprint Delivery Lifecycle Dashboard (Phase 7)
// ============================================================================

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ThemeProvider, createTheme, CssBaseline,
  AppBar, Toolbar, Typography, Box, Button, IconButton,
  CircularProgress, Alert, Tooltip, ToggleButton, ToggleButtonGroup,
  Tabs, Tab,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';
import AddIcon from '@mui/icons-material/Add';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import SettingsIcon from '@mui/icons-material/Settings';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import BarChartIcon from '@mui/icons-material/BarChart';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useDashboard } from './hooks/useDashboard';
import PipelineRow from './components/PipelineRow';
import StageDetailPanel from './components/StageDetailPanel';
import SprintSelector from './components/SprintSelector';
import AddCardDialog from './components/AddCardDialog';
import SprintHealthPanel from './components/SprintHealthPanel';
import FilterBar from './components/FilterBar';
import type { FilterState } from './components/FilterBar';
import NotificationBell from './components/NotificationBell';
import VelocityTrendsPanel from './components/VelocityTrendsPanel';
import SwimlaneView from './components/SwimlaneView';
import ExportMenu from './components/ExportMenu';
import CardDeepDiveModal from './components/CardDeepDiveModal';
import SprintComparisonPanel from './components/SprintComparisonPanel';
import DependencyGraphPanel from './components/DependencyGraphPanel';
import SettingsPanel from './components/SettingsPanel';
import BurndownChart from './components/BurndownChart';
import CumulativeFlowDiagram from './components/CumulativeFlowDiagram';
import LeadTimeHistogram from './components/LeadTimeHistogram';
import TeamWorkloadPanel from './components/TeamWorkloadPanel';
import StageHeatmap from './components/StageHeatmap';
import ThroughputTrendChart from './components/ThroughputTrendChart';
import PipelineFiltersDialog from './components/PipelineFiltersDialog';
import BrandingReveal from './components/BrandingReveal';
import ChartErrorBoundary from './components/ChartErrorBoundary';
import TicketAnalyzerPanel from './components/TicketAnalyzerPanel';
import AgentMonitorPanel from './components/AgentMonitorPanel';
import type { LifecycleStage } from './types';

// ============================================================================
// User Preferences (localStorage persistence)
// ============================================================================
const PREFS_KEY = 'sprint-dashboard-prefs';

interface UserPreferences {
  darkMode: boolean;
  viewMode: 'flat' | 'swimlane';
  collapsedPanels: string[];
}

function loadPrefs(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...defaultPrefs, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultPrefs;
}

const defaultPrefs: UserPreferences = {
  darkMode: false,
  viewMode: 'flat',
  collapsedPanels: [],
};

function savePrefs(prefs: UserPreferences) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

// ============================================================================
// Theme factory
// ============================================================================
function buildTheme(dark: boolean) {
  return createTheme({
    palette: {
      mode: dark ? 'dark' : 'light',
      primary: { main: '#0078d4' },
      success: { main: '#107c10' },
      error: { main: '#d13438' },
      warning: { main: '#ca5010' },
      background: dark
        ? { default: '#1b1b1b', paper: '#2d2d2d' }
        : { default: '#faf9f8', paper: '#ffffff' },
      text: dark
        ? { primary: '#e1e1e1', secondary: '#a19f9d' }
        : { primary: '#323130', secondary: '#605e5c' },
    },
    typography: {
      fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", sans-serif',
    },
    shape: { borderRadius: 4 },
  });
}

const App: React.FC = () => {
  const [prefs, setPrefs] = useState<UserPreferences>(loadPrefs);
  const theme = useMemo(() => buildTheme(prefs.darkMode), [prefs.darkMode]);

  const { data, loading, error, syncing, selectedSprintId, refresh, triggerSync, selectSprint } = useDashboard();
  const [selectedStage, setSelectedStage] = useState<{ cardId: number; stage: LifecycleStage } | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterState | null>(null);
  const [viewMode, setViewMode] = useState<'flat' | 'swimlane'>(prefs.viewMode);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deepDiveCardId, setDeepDiveCardId] = useState<number | null>(null);
  const [chartsTab, setChartsTab] = useState(0);  // 0=pipeline, 1=charts
  const [pipelineFiltersOpen, setPipelineFiltersOpen] = useState(false);
  const [mainTab, setMainTab] = useState(0);       // 0=dashboard, 1=ticket analyzer, 2=agent

  // Persist preferences
  useEffect(() => { savePrefs(prefs); }, [prefs]);
  useEffect(() => { setPrefs(p => ({ ...p, viewMode })); }, [viewMode]);

  const toggleDarkMode = () => {
    setPrefs(p => ({ ...p, darkMode: !p.darkMode }));
  };

  const handleStageClick = (cardId: number, stage: LifecycleStage) => {
    if (selectedStage?.cardId === cardId && selectedStage?.stage === stage) {
      setSelectedStage(null);
    } else {
      setSelectedStage({ cardId, stage });
    }
  };

  const handleFilterChange = useCallback((filters: FilterState) => {
    const hasFilters = filters.query || filters.assignee || filters.stage || filters.status || filters.issueType;
    setActiveFilters(hasFilters ? filters : null);
  }, []);

  // Client-side filtering (fast, no extra API call)
  const filteredCards = useMemo(() => {
    if (!data?.cards) return [];
    if (!activeFilters) return data.cards;

    let cards = [...data.cards];

    if (activeFilters.query) {
      const q = activeFilters.query.toLowerCase();
      cards = cards.filter(c =>
        c.card.ticket_id.toLowerCase().includes(q) ||
        c.card.summary.toLowerCase().includes(q)
      );
    }
    if (activeFilters.assignee) {
      cards = cards.filter(c => c.card.assignee === activeFilters.assignee);
    }
    if (activeFilters.stage) {
      cards = cards.filter(c => c.card.current_stage === activeFilters.stage);
    }
    if (activeFilters.issueType) {
      cards = cards.filter(c => c.card.issue_type === activeFilters.issueType);
    }
    if (activeFilters.status) {
      cards = cards.filter(c => {
        const currentStageInfo = c.stages.find(s => s.stage === c.card.current_stage);
        return currentStageInfo?.status === activeFilters.status;
      });
    }

    // Sorting
    const sortKey = activeFilters.sortBy || 'ticket';
    const dir = activeFilters.sortOrder === 'desc' ? -1 : 1;
    cards.sort((a, b) => {
      let va = '', vb = '';
      if (sortKey === 'ticket') { va = a.card.ticket_id; vb = b.card.ticket_id; }
      else if (sortKey === 'assignee') { va = a.card.assignee || ''; vb = b.card.assignee || ''; }
      else if (sortKey === 'priority') { va = a.card.priority; vb = b.card.priority; }
      else if (sortKey === 'stage') { va = a.card.current_stage; vb = b.card.current_stage; }
      else if (sortKey === 'updated') { va = a.card.updated_at; vb = b.card.updated_at; }
      return va.localeCompare(vb) * dir;
    });

    return cards;
  }, [data?.cards, activeFilters]);

  const selectedCardData = selectedStage
    ? data?.cards.find(c => c.card.id === selectedStage.cardId)
    : null;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'background.default' }}>
        {/* App Bar */}
        <AppBar position="static" elevation={0} sx={{ backgroundColor: '#0078d4' }}>
          <Toolbar variant="dense" sx={{ gap: 1.5 }}>
            <DashboardIcon sx={{ fontSize: 22 }} />
            <BrandingReveal variant="h6" sx={{ flexGrow: 0, mr: 1 }} />

            {/* Top-level navigation tabs */}
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 2, borderRight: '1px solid rgba(255,255,255,0.25)', pr: 2 }}>
              <Tabs
                value={mainTab}
                onChange={(_, v) => setMainTab(v)}
                sx={{
                  minHeight: 36,
                  '& .MuiTab-root': { minHeight: 36, py: 0, color: 'rgba(255,255,255,0.7)', textTransform: 'none', fontSize: '0.78rem', px: 1.25 },
                  '& .Mui-selected': { color: '#fff !important' },
                  '& .MuiTabs-indicator': { backgroundColor: '#fff' },
                }}
              >
                <Tab icon={<DashboardIcon sx={{ fontSize: 15 }} />} iconPosition="start" label="Sprint Dashboard" />
                <Tab icon={<ManageSearchIcon sx={{ fontSize: 15 }} />} iconPosition="start" label="Ticket Analyzer" />
                <Tab icon={<SmartToyIcon sx={{ fontSize: 15 }} />} iconPosition="start" label="Vishvakarma" />
              </Tabs>
            </Box>

            {/* Sprint Selector — only on Dashboard tab */}
            {mainTab === 0 && data?.sprints && data.sprints.length > 0 && (
              <SprintSelector
                sprints={data.sprints}
                selectedId={data.sprint?.id || selectedSprintId}
                onSelect={selectSprint}
              />
            )}

            <Box sx={{ flexGrow: 1 }} />

            {/* Actions */}
            <Tooltip title="Sync Jira & Bitbucket">
              <span>
                <IconButton
                  color="inherit"
                  onClick={triggerSync}
                  disabled={syncing}
                  size="small"
                >
                  {syncing ? <CircularProgress size={18} color="inherit" /> : <SyncIcon sx={{ fontSize: 20 }} />}
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="Refresh">
              <IconButton color="inherit" onClick={refresh} size="small">
                <RefreshIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>

            {data?.sprint && (
              <Tooltip title="Add Card">
                <IconButton color="inherit" onClick={() => setAddDialogOpen(true)} size="small">
                  <AddIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            )}

            {/* Phase 5: Export */}
            <ExportMenu sprintId={data?.sprint?.id} sprintName={data?.sprint?.name} />

            {/* Phase 5: Notifications */}
            <NotificationBell />

            {/* Phase 6: Settings */}
            <Tooltip title="Settings">
              <IconButton color="inherit" onClick={() => setSettingsOpen(true)} size="small">
                <SettingsIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>

            {/* Phase 6: Dark Mode */}
            <Tooltip title={prefs.darkMode ? 'Light Mode' : 'Dark Mode'}>
              <IconButton color="inherit" onClick={toggleDarkMode} size="small">
                {prefs.darkMode ? <LightModeIcon sx={{ fontSize: 20 }} /> : <DarkModeIcon sx={{ fontSize: 20 }} />}
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        {/* ── Sprint Dashboard (mainTab === 0) ────────────────────── */}
        {mainTab === 0 && (<>

        {/* Sprint Info Bar */}
        {data?.sprint && (
          <Box sx={{
            px: 3, py: 1,
            backgroundColor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {data.sprint.name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#605e5c' }}>
              {(() => {
                const plural = data.cards.length === 1 ? '' : 's';
                return activeFilters
                  ? `${filteredCards.length}/${data.cards.length} card${plural}`
                  : `${data.cards.length} card${plural}`;
              })()}
            </Typography>
            {data.sprint.start_date && (
              <Typography variant="caption" sx={{ color: '#a19f9d' }}>
                {new Date(data.sprint.start_date).toLocaleDateString()} — {data.sprint.end_date ? new Date(data.sprint.end_date).toLocaleDateString() : 'ongoing'}
              </Typography>
            )}
            <Box sx={{ flexGrow: 1 }} />
            {/* Stage Legend */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              {[
                { color: '#8a8a8a', label: 'Pending' },
                { color: '#0078d4', label: 'Active' },
                { color: '#107c10', label: 'Completed' },
                { color: '#d13438', label: 'Failed' },
                { color: '#ca5010', label: 'Waiting' },
              ].map(item => (
                <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color }} />
                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#605e5c' }}>
                    {item.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Phase 4: Sprint Health Analytics */}
        {data?.sprint && (
          <SprintHealthPanel sprintId={data.sprint.id} />
        )}

        {/* Phase 5: Velocity & Trends */}
        {data?.sprint && (
          <VelocityTrendsPanel sprintId={data.sprint.id} />
        )}

        {/* Phase 6: Sprint Comparison */}
        {data?.sprint && (
          <SprintComparisonPanel />
        )}

        {/* Phase 6: Dependency Graph */}
        {data?.sprint && (
          <DependencyGraphPanel sprintId={data.sprint.id} />
        )}

        {/* Phase 7: View Tabs — Pipeline | Charts */}
        {data?.sprint && data.cards.length > 0 && (
          <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 1, backgroundColor: 'background.paper' }}>
            <Tabs
              value={chartsTab}
              onChange={(_, v) => setChartsTab(v)}
              sx={{ minHeight: 32, '& .MuiTab-root': { minHeight: 32, py: 0.5, fontSize: '0.8rem', textTransform: 'none' } }}
            >
              <Tab icon={<ViewListIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Pipeline View" />
              <Tab icon={<BarChartIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Charts & Analytics" />
            </Tabs>
          </Box>
        )}

        {/* Phase 4: Filter Bar + Phase 5: View Toggle (only in Pipeline tab) */}
        {chartsTab === 0 && data?.sprint && data.cards.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 3, py: 0.5, borderBottom: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper' }}>
            <Box sx={{ flex: 1 }}>
              <FilterBar sprintId={data.sprint.id} onFilterChange={handleFilterChange} />
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FilterAltIcon sx={{ fontSize: 16 }} />}
              onClick={() => setPipelineFiltersOpen(true)}
              sx={{ textTransform: 'none' }}
            >
              Pipeline Filters
            </Button>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, v) => v && setViewMode(v)}
              size="small"
            >
              <ToggleButton value="flat" sx={{ px: 1.5, py: 0.25 }}>
                <Tooltip title="Flat list"><ViewListIcon sx={{ fontSize: 18 }} /></Tooltip>
              </ToggleButton>
              <ToggleButton value="swimlane" sx={{ px: 1.5, py: 0.25 }}>
                <Tooltip title="Swimlane view"><ViewModuleIcon sx={{ fontSize: 18 }} /></Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}

        {/* Main Content */}
        <Box sx={{ flex: 1, p: 3, mr: selectedStage ? { xs: 0, sm: '420px' } : 0, transition: 'margin 0.3s' }}>
          {loading && !data && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>Loading dashboard...</Typography>
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {!loading && data?.cards.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <DashboardIcon sx={{ fontSize: 64, color: '#d2d0ce', mb: 2 }} />
              <Typography variant="h6" sx={{ color: '#605e5c', mb: 1 }}>
                No cards in this sprint
              </Typography>
              <Typography variant="body2" sx={{ color: '#a19f9d', mb: 2 }}>
                Sync with Jira to load sprint cards, or add a card manually.
              </Typography>
              <Button variant="contained" startIcon={<SyncIcon />} onClick={triggerSync} disabled={syncing}>
                {syncing ? 'Syncing...' : 'Sync from Jira'}
              </Button>
            </Box>
          )}

          {/* Tab 0: Pipeline View */}
          {chartsTab === 0 && data && data.cards.length > 0 && (
            <Box>
              {viewMode === 'swimlane' ? (
                <SwimlaneView
                  sprintId={data.sprint?.id}
                  selectedStage={selectedStage}
                  onStageClick={handleStageClick}
                />
              ) : filteredCards.length === 0 && activeFilters ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Typography variant="body2" sx={{ color: '#605e5c' }}>
                    No cards match the current filters
                  </Typography>
                </Box>
              ) : (
                filteredCards.map(cardData => (
                  <PipelineRow
                    key={cardData.card.id}
                    cardData={cardData}
                    selectedStage={selectedStage}
                    onStageClick={handleStageClick}
                    onCardClick={(cardId) => setDeepDiveCardId(cardId)}
                  />
                ))
              )}
            </Box>
          )}

          {/* Tab 1: Charts & Analytics */}
          {chartsTab === 1 && data?.sprint && (
            <Box sx={{ mx: -3, mt: -2 }}>
              <ChartErrorBoundary title="Sprint Burndown">
                <BurndownChart sprintId={data.sprint.id} />
              </ChartErrorBoundary>
              <ChartErrorBoundary title="Cumulative Flow">
                <CumulativeFlowDiagram sprintId={data.sprint.id} />
              </ChartErrorBoundary>
              <ChartErrorBoundary title="Lead Time Histogram">
                <LeadTimeHistogram sprintId={data.sprint.id} />
              </ChartErrorBoundary>
              <ChartErrorBoundary title="Team Workload">
                <TeamWorkloadPanel sprintId={data.sprint.id} />
              </ChartErrorBoundary>
              <ChartErrorBoundary title="Stage Heatmap">
                <StageHeatmap sprintId={data.sprint.id} />
              </ChartErrorBoundary>
              <ChartErrorBoundary title="Throughput Trend">
                <ThroughputTrendChart />
              </ChartErrorBoundary>
            </Box>
          )}
        </Box>

        {/* Stage Detail Panel */}
        {selectedStage && selectedCardData && (
          <StageDetailPanel
            cardData={selectedCardData}
            stage={selectedStage.stage}
            onClose={() => setSelectedStage(null)}
            onRefresh={refresh}
          />
        )}

        {/* Add Card Dialog */}
        {data?.sprint && (
          <AddCardDialog
            open={addDialogOpen}
            sprintId={data.sprint.id}
            onClose={() => setAddDialogOpen(false)}
            onAdded={refresh}
          />
        )}

        {/* Phase 6: Card Deep Dive Modal */}
        <CardDeepDiveModal
          cardId={deepDiveCardId || 0}
          open={deepDiveCardId !== null}
          onClose={() => setDeepDiveCardId(null)}
        />

        {/* Phase 6: Settings Panel */}
        <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

        {/* Phase 9: Pipeline Filters Dialog */}
        <PipelineFiltersDialog open={pipelineFiltersOpen} onClose={() => setPipelineFiltersOpen(false)} />

        </>)} {/* end mainTab === 0 */}

        {/* Tab 1: Ticket Analyzer */}
        {mainTab === 1 && (
          <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: 'background.default' }}>
            <TicketAnalyzerPanel />
          </Box>
        )}

        {/* Tab 2: Vishvakarma Agent */}
        {mainTab === 2 && (
          <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: 'background.default' }}>
            <AgentMonitorPanel />
          </Box>
        )}
      </Box>
    </ThemeProvider>
  );
};

export default App;
