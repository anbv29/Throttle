import { Bell, Database, Laptop, Moon, Palette, Server, Sun } from 'lucide-react';
import { GlassSurface, PageHeader, StatusBadge } from '../components/Glass.jsx';
import { ThemeControl } from '../components/ThemeControl.jsx';

export function SettingsPage({ theme, setTheme, apiOnline, health }) {
  return (
    <div className="page-wrap settings-page">
      <PageHeader eyebrow="Workspace preferences" title="Settings" description="Tune the console experience and inspect its active environment." />
      <div className="settings-grid">
        <GlassSurface className="settings-card"><div className="settings-card-heading"><span><Palette /></span><div><h2>Appearance</h2><p>Choose a theme or follow your operating system.</p></div></div><ThemeControl theme={theme} onChange={setTheme} /><div className="theme-previews"><button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}><span className="light-preview"><i /><i /><i /></span><Sun size={15} />Light</button><button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}><span className="dark-preview"><i /><i /><i /></span><Moon size={15} />Dark</button><button className={theme === 'system' ? 'active' : ''} onClick={() => setTheme('system')}><span className="system-preview"><i /><i /><i /></span><Laptop size={15} />System</button></div><p className="settings-note">Your preference is stored only in this browser and applied before the next render.</p></GlassSurface>
        <GlassSurface className="settings-card"><div className="settings-card-heading"><span><Server /></span><div><h2>Runtime environment</h2><p>Actual readiness reported by the backend.</p></div></div><div className="environment-list"><div><span><Server />Rate limiter API</span><StatusBadge tone={apiOnline ? 'success' : 'danger'}>{apiOnline ? 'Healthy' : 'Offline'}</StatusBadge></div><div><span><Database />PostgreSQL</span><StatusBadge tone={health?.database === 'ready' ? 'success' : 'danger'}>{health?.database === 'ready' ? 'Connected' : 'Unavailable'}</StatusBadge></div><div><span><Bell />Database latency</span><strong>{health?.databaseLatencyMilliseconds ?? '—'} ms</strong></div></div></GlassSurface>
      </div>
    </div>
  );
}
