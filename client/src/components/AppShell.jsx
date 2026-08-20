import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity, BookOpen, Boxes, Braces, ChevronLeft, CircleGauge, FlaskConical,
  Home, Menu, Network, PanelLeftClose, PanelLeftOpen, Settings, Users, X,
} from 'lucide-react';
import { GlassSurface, StatusBadge } from './Glass.jsx';
import { ThemeControl } from './ThemeControl.jsx';

const navigationGroups = [
  { label: 'Product', items: [{ route: '/', label: 'Product overview', Icon: Home }] },
  {
    label: 'Operate', items: [
      { route: '/dashboard', label: 'Dashboard', Icon: CircleGauge },
      { route: '/clients', label: 'Clients', Icon: Users },
      { route: '/tester', label: 'Live tester', Icon: FlaskConical },
      { route: '/analytics', label: 'Traffic & analytics', Icon: Activity },
    ],
  },
  {
    label: 'Learn', items: [
      { route: '/how-it-works', label: 'How it works', Icon: BookOpen },
      { route: '/api-guide', label: 'API integration', Icon: Braces },
      { route: '/architecture', label: 'Architecture', Icon: Network },
    ],
  },
  { label: 'Workspace', items: [{ route: '/settings', label: 'Settings', Icon: Settings }] },
];

export function Brand({ onClick }) {
  return (
    <button className="brand-button" onClick={onClick} aria-label="Go to product overview">
      <span className="brand-symbol"><Boxes size={19} /></span>
      <span><strong>Throttle</strong><small>Traffic control</small></span>
    </button>
  );
}

export function AppShell({ route, navigate, theme, setTheme, apiOnline, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  function go(target) {
    navigate(target);
    setMobileOpen(false);
  }

  return (
    <div className={`product-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <button className="mobile-menu-button glass-surface" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
      {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <GlassSurface as="aside" className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand-row">
          <Brand onClick={() => go('/')} />
          <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <nav aria-label="Main navigation">
          {navigationGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map(({ route: target, label, Icon }) => {
                const active = route === target || (target === '/clients' && route.startsWith('/clients/'));
                return (
                  <button className={active ? 'active' : ''} key={target} onClick={() => go(target)} title={collapsed ? label : undefined}>
                    {active && <motion.i className="nav-active-marker" layoutId="nav-active" transition={{ type: 'spring', stiffness: 460, damping: 38 }} />}
                    <Icon size={17} aria-hidden="true" /><span>{label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-health">
            <StatusBadge tone={apiOnline ? 'success' : 'danger'}>{apiOnline ? 'All systems ready' : 'Service offline'}</StatusBadge>
            <small>{apiOnline ? 'PostgreSQL connected' : 'Retrying connection'}</small>
          </div>
          <button className="collapse-button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}<span>{collapsed ? 'Expand' : 'Collapse'}</span>
          </button>
        </div>
      </GlassSurface>

      <div className="app-content">
        <GlassSurface as="header" className="app-topbar">
          <button className="back-overview" onClick={() => go('/')}><ChevronLeft size={15} /> Product overview</button>
          <div className="topbar-actions">
            <StatusBadge tone={apiOnline ? 'success' : 'danger'}>{apiOnline ? 'API healthy' : 'API offline'}</StatusBadge>
            <ThemeControl theme={theme} onChange={setTheme} compact />
          </div>
        </GlassSurface>
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            className="route-content"
            key={route}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -5 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
