import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatVariant = 'default' | 'accent' | 'good' | 'warn' | 'crit';

interface StatTileProps {
  label: string;
  value: string | number;
  sub?: string;
  variant?: StatVariant;
}

const VARIANTS: Record<StatVariant, { card: string; value: string; text: string }> = {
  default: { card: '',                                   value: 'text-foreground',  text: 'text-muted-foreground' },
  accent:  { card: '',                                   value: 'text-foreground',  text: 'text-muted-foreground' },
  good:    { card: 'border-transparent bg-onsite-bg',    value: 'text-onsite-fg',   text: 'text-onsite-fg/70' },
  warn:    { card: 'border-transparent bg-atrisk-bg',    value: 'text-atrisk-fg',   text: 'text-atrisk-fg/70' },
  crit:    { card: 'border-transparent bg-late-bg',      value: 'text-late-fg',     text: 'text-late-fg/70' },
};

export default function StatTile({ label, value, sub, variant = 'default' }: StatTileProps) {
  const v = VARIANTS[variant];
  return (
    <Card className={cn('gap-0 rounded-xl px-4 py-3.5 shadow-none', v.card)}>
      <p className={cn('text-xs font-medium', v.text)}>{label}</p>
      <p className={cn('mt-1.5 text-2xl font-semibold leading-none tracking-tight tabular', v.value)}>
        {value}
      </p>
      {sub && <p className={cn('mt-1.5 text-[11px]', v.text)}>{sub}</p>}
    </Card>
  );
}
