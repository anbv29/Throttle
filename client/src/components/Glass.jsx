export function GlassSurface({ as: Element = 'div', className = '', children, ...props }) {
  return <Element className={`glass-surface ${className}`.trim()} {...props}>{children}</Element>;
}

export function StatusBadge({ tone = 'neutral', children }) {
  return <span className={`status-badge ${tone}`}><i aria-hidden="true" />{children}</span>;
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <GlassSurface className="empty-state-premium">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </GlassSurface>
  );
}

export function Skeleton({ className = '' }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}
