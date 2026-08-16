import type { ItemStatus } from '@/types';
import {
  Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatTone = 'neutral' | ItemStatus;

interface StatTileProps {
  label: string;
  value: string | number;
  sub?: string;
  /** Ties the tile to a schedule state so it reads in the same colours as the badges. */
  tone?: StatTone;
  /** A count of zero carries no news — only a live one earns its colour. */
  active?: boolean;
  /** Lets a tile claim a wider slot — used to fill the odd row on a phone. */
  className?: string;
}

/**
 * Only the states that ask for action are tinted; the healthy ones settle for a
 * dot. Five equally coloured tiles say nothing about where to look first.
 */
const TONES: Record<ItemStatus, { dot: string; value: string; card: string }> = {
  planning: { dot: 'bg-planning', value: '', card: '' },
  ontrack:  { dot: 'bg-ontrack',  value: '', card: '' },
  onsite:   { dot: 'bg-onsite',   value: '', card: '' },
  atrisk:   { dot: 'bg-atrisk', value: 'text-atrisk-fg', card: 'bg-atrisk-bg/60 ring-atrisk/25' },
  late:     { dot: 'bg-late',   value: 'text-late-fg',   card: 'bg-late-bg/60 ring-late/25' },
};

export default function StatTile({
  label, value, sub, tone = 'neutral', active = true, className,
}: StatTileProps) {
  const t = tone === 'neutral' || !active ? null : TONES[tone];

  return (
    <Card className={cn('gap-1', t?.card, className)}>
      <CardHeader className="gap-0">
        <CardDescription className="truncate text-xs font-medium">{label}</CardDescription>
        <CardAction>
          <span className={cn('mt-1.5 block size-2 rounded-full', t?.dot ?? 'bg-muted-foreground/25')} />
        </CardAction>
        <CardTitle className={cn('text-2xl font-semibold tracking-tight tabular sm:text-3xl', t?.value)}>
          {value}
        </CardTitle>
      </CardHeader>
      {sub && (
        <CardContent>
          <p className="truncate text-xs text-muted-foreground">{sub}</p>
        </CardContent>
      )}
    </Card>
  );
}
