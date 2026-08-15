import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatVariant = 'default' | 'accent' | 'good' | 'info' | 'warn' | 'crit';

interface StatTileProps {
  label: string;
  value: string | number;
  sub?: string;
  variant?: StatVariant;
  /** Lets a tile claim a wider slot — used to fill the odd row on a phone. */
  className?: string;
}

const VARIANTS: Record<StatVariant, { card: string; value: string; text: string }> = {
  default: { card: '',                                   value: 'text-foreground',  text: 'text-muted-foreground' },
  accent:  { card: '',                                   value: 'text-foreground',  text: 'text-muted-foreground' },
  good:    { card: 'border-transparent bg-ontrack-bg',   value: 'text-ontrack-fg',  text: 'text-ontrack-fg/70' },
  info:    { card: 'border-transparent bg-onsite-bg',    value: 'text-onsite-fg',   text: 'text-onsite-fg/70' },
  warn:    { card: 'border-transparent bg-atrisk-bg',    value: 'text-atrisk-fg',   text: 'text-atrisk-fg/70' },
  crit:    { card: 'border-transparent bg-late-bg',      value: 'text-late-fg',     text: 'text-late-fg/70' },
};

export default function StatTile({
  label, value, sub, variant = 'default', className,
}: StatTileProps) {
  const v = VARIANTS[variant];
  return (
    <Card className={cn('gap-0 rounded-xl px-3.5 py-3 shadow-none sm:px-4 sm:py-3.5', v.card, className)}>
      <p className={cn('truncate text-xs font-medium', v.text)}>{label}</p>
      <p className={cn('mt-1.5 text-xl font-semibold leading-none tracking-tight tabular sm:text-2xl', v.value)}>
        {value}
      </p>
      {sub && <p className={cn('mt-1.5 truncate text-[11px]', v.text)}>{sub}</p>}
    </Card>
  );
}
