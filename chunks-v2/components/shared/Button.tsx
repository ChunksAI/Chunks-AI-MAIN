import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary:   'ws-add-btn',
  secondary: 'panel-btn',
  ghost:     'icon-btn',
  danger:    'review-session-btn',
};

export default function Button({
  variant = 'primary',
  size,
  icon,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${variantClass[variant]} ${className}`}
      {...props}
    >
      {icon && icon}
      {children}
    </button>
  );
}
