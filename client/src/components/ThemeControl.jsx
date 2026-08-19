import { Laptop, Moon, Sun } from 'lucide-react';

const options = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Laptop },
];

export function ThemeControl({ theme, onChange, compact = false }) {
  return (
    <div className={`theme-control ${compact ? 'compact' : ''}`} role="radiogroup" aria-label="Color theme">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          className={theme === value ? 'active' : ''}
          onClick={() => onChange(value)}
          title={`${label} mode`}
        >
          <Icon size={14} aria-hidden="true" />
          {!compact && <span>{label}</span>}
        </button>
      ))}
    </div>
  );
}
