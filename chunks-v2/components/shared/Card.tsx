interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

/**
 * Generic surface card — used for review cards, ws cards, etc.
 * Consumers pass the className that applies the correct variant styles
 * (ws-card, review-card) keeping Card itself simple.
 */
export default function Card({ children, className = 'review-card', style, onClick }: CardProps) {
  return (
    <div className={className} style={style} onClick={onClick}>
      {children}
    </div>
  );
}
