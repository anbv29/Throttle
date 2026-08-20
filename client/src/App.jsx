import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AppShell } from './components/AppShell.jsx';
import { AnalyticsPage } from './pages/AnalyticsPage.jsx';
import { ApiGuidePage } from './pages/ApiGuidePage.jsx';
import { ArchitecturePage } from './pages/ArchitecturePage.jsx';
import { ClientDetailsPage } from './pages/ClientDetailsPage.jsx';
import { ClientsPage } from './pages/ClientsPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { HowItWorksPage } from './pages/HowItWorksPage.jsx';
import { LandingPage } from './pages/LandingPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { TesterPage } from './pages/TesterPage.jsx';
import { api } from './lib/api.js';

const emptyOverview = {
  totalClients: 0, activeClients: 0, totalAllowed: 0, totalDenied: 0,
  averageResponseTimeMs: 0, recentActivity: [],
};

function getHashRoute() {
  const route = window.location.hash.replace(/^#/, '');
  return route || '/';
}

function useTheme() {
  const [theme, setThemeState] = useState(() => localStorage.getItem('throttle-theme') || 'system');

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.themePreference = theme;
      document.documentElement.style.colorScheme = resolved;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  function setTheme(nextTheme) {
    localStorage.setItem('throttle-theme', nextTheme);
    setThemeState(nextTheme);
  }
  return [theme, setTheme];
}

export default function App() {
  const [route, setRoute] = useState(getHashRoute);
  const [theme, setTheme] = useTheme();
  const [overview, setOverview] = useState(emptyOverview);
  const [clients, setClients] = useState([]);
  const [health, setHealth] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [range, setRange] = useState('15m');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const navigate = useCallback((target) => {
    if (window.location.hash === `#${target}`) setRoute(target);
    else window.location.hash = target;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const updateRoute = () => setRoute(getHashRoute());
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);

  const loadBaseData = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const [overviewResponse, clientsResponse, healthResponse] = await Promise.all([
        api.overview(), api.clients(), api.health(),
      ]);
      setOverview(overviewResponse.body);
      setClients(clientsResponse.body.clients);
      setHealth(healthResponse.body);
      setApiOnline(true);
      setError('');
    } catch (loadError) {
      setApiOnline(false);
      if (!quiet) setError(loadError.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try { setAnalytics((await api.analytics(range)).body); }
    catch (loadError) { setError(loadError.message); }
  }, [range]);

  const refresh = useCallback(async () => {
    await Promise.all([loadBaseData(), loadAnalytics()]);
  }, [loadAnalytics, loadBaseData]);

  useEffect(() => { loadBaseData(); }, [loadBaseData]);
  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      loadBaseData({ quiet: true });
      if (route === '/dashboard' || route === '/analytics') loadAnalytics();
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [loadAnalytics, loadBaseData, route]);

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  }

  async function saveClient(configuration, editingClient) {
    setSaving(true); setError('');
    try {
      if (editingClient) await api.updateClient(editingClient.clientKey, configuration);
      else await api.createClient(configuration);
      showNotice(editingClient ? 'Client policy updated' : 'Client policy created');
      await loadBaseData();
    } catch (saveError) { setError(saveError.message); throw saveError; }
    finally { setSaving(false); }
  }

  async function deleteClient(clientKey) {
    if (!window.confirm(`Delete ${clientKey}? Its algorithm state will also be removed.`)) return;
    try { await api.deleteClient(clientKey); showNotice('Client deleted'); await loadBaseData(); }
    catch (deleteError) { setError(deleteError.message); }
  }

  async function createTestClient() {
    const clientKey = 'throttle_demo';
    if (clients.some((client) => client.clientKey === clientKey)) return clientKey;
    setSaving(true);
    try {
      await api.createClient({
        clientKey,
        algorithm: 'sliding_window',
        maxRequests: 20,
        windowSeconds: 60,
      });
      showNotice('Test client created');
    } catch (createError) {
      if (createError.code !== 'DUPLICATE_CLIENT_KEY') throw createError;
    } finally {
      setSaving(false);
    }
    await loadBaseData();
    return clientKey;
  }

  async function checkClient(clientKey, options) {
    const response = await api.check(clientKey, options);
    if (options?.refresh !== false) {
      window.setTimeout(() => loadBaseData({ quiet: true }), 150);
    }
    return { ...response.body, checkedAt: new Date().toISOString() };
  }

  let page;
  if (route === '/') {
    return <LandingPage navigate={navigate} theme={theme} setTheme={setTheme} apiOnline={apiOnline} />;
  } else if (route === '/dashboard') {
    page = <DashboardPage overview={overview} analytics={analytics} range={range} setRange={setRange} loading={loading} refresh={refresh} apiOnline={apiOnline} health={health} />;
  } else if (route === '/clients') {
    page = <ClientsPage clients={clients} navigate={navigate} saveClient={saveClient} deleteClient={deleteClient} saving={saving} />;
  } else if (route.startsWith('/clients/')) {
    page = <ClientDetailsPage clientKey={decodeURIComponent(route.slice('/clients/'.length))} clients={clients} navigate={navigate} onCheck={checkClient} />;
  } else if (route === '/tester') {
    page = <TesterPage clients={clients} onCheck={checkClient} onCreateTestClient={createTestClient} creatingClient={saving} />;
  } else if (route === '/analytics') {
    page = <AnalyticsPage analytics={analytics} overview={overview} range={range} setRange={setRange} loading={loading} />;
  } else if (route === '/how-it-works') {
    page = <HowItWorksPage />;
  } else if (route === '/api-guide') {
    page = <ApiGuidePage />;
  } else if (route === '/architecture') {
    page = <ArchitecturePage />;
  } else if (route === '/settings') {
    page = <SettingsPage theme={theme} setTheme={setTheme} apiOnline={apiOnline} health={health} />;
  } else {
    page = <div className="not-found-page"><h1>Page not found</h1><button className="button primary" onClick={() => navigate('/')}>Return home</button></div>;
  }

  return (
    <AppShell route={route} navigate={navigate} theme={theme} setTheme={setTheme} apiOnline={apiOnline}>
      {error && <div className="global-alert" role="alert"><AlertTriangle size={17} /><div><strong>Unable to load live data</strong><span>{error}</span></div><button onClick={() => { setError(''); refresh(); }} aria-label="Retry and dismiss"><X size={16} /></button></div>}
      {page}
      {notice && <div className="toast-premium" role="status"><span aria-hidden="true">✓</span>{notice}</div>}
    </AppShell>
  );
}
