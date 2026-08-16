import type { ItemStatus } from '@/types';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatTone = 'neutral' | ItemStatus;

interface StatTileProps {
  label: string;
  value: string | number;
  sub?: string;
  /** Ties the tile to a schedule state so it reads in the same colours as the badges. */
  tone?: StatTone;
  /** Lets a tile claim a wider slot — used to fill the odd row on a phone. */
  className?: string;
}

/**
 * Each state owns its tile outright — ground, figure and edge. A tinted
 * square is legible from across the room in a way a dot beside a white card
 * never is, which is the whole point of a board someone glances at.
 *
 * Written out in full: Tailwind only emits the classes it can see here.
 */
const TONES: Record<ItemStatus, { card: string; value: string; text: string }> = {
  planning: { card: 'bg-planning-bg ring-planning/20', value: 'text-planning-fg', text: 'text-planning-fg/75' },
  onsite:   { card: 'bg-onsite-bg ring-onsite/20',     value: 'text-onsite-fg',   text: 'text-onsite-fg/75' },
  ontrack:  { card: 'bg-ontrack-bg ring-ontrack/20',   value: 'text-ontrack-fg',  text: 'text-ontrack-fg/75' },
  atrisk:   { card: 'bg-atrisk-bg ring-atrisk/25',     value: 'text-atrisk-fg',   text: 'text-atrisk-fg/75' },
  late:     { card: 'bg-late-bg ring-late/20',         value: 'text-late-fg',     text: 'text-late-fg/75' },
};

export default function StatTile({
  label, value, sub, tone = 'neutral', className,
}: StatTileProps) {
  const t = tone === 'neutral' ? null : TONES[tone];

  return (
    <Card className={cn('gap-1', t?.card, className)}>
      <CardHeader className="gap-0">
        <CardDescription className={cn('truncate text-xs font-medium', t?.text)}>
          {label}
        </CardDescription>
        <CardTitle className={cn('text-2xl font-semibold tracking-tight tabular sm:text-3xl', t?.value)}>
          {value}
        </CardTitle>
      </CardHeader>
      {sub && (
        <CardContent>
          <p className={cn('truncate text-xs', t?.text ?? 'text-muted-foreground')}>{sub}</p>
        </CardContent>
      )}
    </Card>
  );
}
