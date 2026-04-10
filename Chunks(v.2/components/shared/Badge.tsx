interface BadgeProps {
  variant: 'ai' | 'pro' | 'success' | 'danger' | 'warning' | 'info';
  children: React.ReactNode;
}

const variantStyles: Record<BadgeProps['variant'], React.CSSProperties> = {
  ai:      { background: 'var(--accent-light)',  color: 'var(--accent)' },
  pro:     { background: 'var(--accent2-light)', color: 'var(--accent2)' },
  success: { background: 'var(--accent2-light)', color: 'var(--accent2)' },
  danger:  { background: 'var(--danger-light)',  color: 'var(--danger)' },
  warning: { background: 'var(--accent-light)',  color: 'var(--accent)' },
  info:    { background: 'var(--blue-light)',    color: 'var(--blue)' },
};

const borderStyles: Record<BadgeProps['variant'], string> = {
  ai:      'rgba(196,146,58,0.2)',
  pro:     'rgba(74,124,89,0.2)',
  success: 'rgba(74,124,89,0.2)',
  danger:  'rgba(196,80,58,0.2)',
  warning: 'rgba(196,146,58,0.2)',
  info:    'rgba(58,95,196,0.2)',
};

export default function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className="topic-chip"
      style={{
        ...variantStyles[variant],
        borderColor: borderStyles[variant],
      }}
    >
      {children}
    </span>
  );
}
