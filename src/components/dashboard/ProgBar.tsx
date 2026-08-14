import { cn } from '@/lib/utils';

interface ProgBarProps {
  value: number;
  className?: string;
  /** Tailwind class for the filled portion. Defaults to the primary colour. */
  indicatorClassName?: string;
}

export default function ProgBar({ value, className, indicatorClassName }: ProgBarProps) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div
        className={cn('h-full rounded-full bg-primary transition-all', indicatorClassName)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
