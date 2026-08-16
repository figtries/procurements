import { getDisciplineStyle } from '@/lib/procurement';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DisciplineBadgeProps {
  discipline: string;
  /** `sm` is for dense list rows; every other surface takes the default. */
  size?: 'default' | 'sm';
  className?: string;
}

/**
 * The one place a discipline turns into a chip.
 *
 * The tint always came from the same token, but each screen dressed it
 * differently — a 10px bold chip on the list, an 11px bold one on the detail,
 * an 11px semibold one on the dashboard. Same colour, three shapes, which
 * reads as three different things. Routing every tag through here is what
 * stops that drifting apart again.
 *
 * Squarer than a status badge on purpose: a discipline says what an item *is*,
 * a status says how it is doing, and the two should not be mistaken for one
 * another at a glance.
 */
export default function DisciplineBadge({
  discipline, size = 'default', className,
}: DisciplineBadgeProps) {
  const style = getDisciplineStyle(discipline);

  return (
    <Badge
      variant="secondary"
      className={cn(
        'shrink-0 rounded-md border-transparent font-semibold',
        size === 'sm' ? 'h-4.5 px-1.5 text-[10px]' : 'h-5 px-2 text-[11px]',
        className,
      )}
      style={{ background: style.bg, color: style.color }}
    >
      {discipline || '—'}
    </Badge>
  );
}
