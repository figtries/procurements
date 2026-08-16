import {
  ChevronRight, CircleDashed, Clock, PackageCheck, TrendingUp, TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { GroupBy, ItemStatus, ProcurementItem } from '@/types';
import { STATUS_CLASSES, fmtDate, getNextMilestone } from '@/lib/procurement';
import StatusBadge from './Badge';
import DisciplineBadge from './DisciplineBadge';
import {
  Item, ItemContent, ItemDescription, ItemFooter, ItemMedia, ItemTitle,
} from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ItemCardProps {
  item: ProcurementItem;
  /** Position in its group, used to stagger the entry animation. */
  index?: number;
  /** The heading already names whatever the list is grouped on, so the row
   *  does not repeat it. */
  groupBy?: GroupBy;
  onClick: () => void;
}

/** Cap the stagger so long lists do not crawl in. */
const MAX_STAGGER = 8;

/** One glyph per schedule state — the row reads before any of its text does. */
const STATUS_ICON: Record<ItemStatus, LucideIcon> = {
  planning: CircleDashed,
  ontrack:  TrendingUp,
  atrisk:   Clock,
  late:     TriangleAlert,
  onsite:   PackageCheck,
};

export default function ItemCard({ item, index = 0, groupBy, onClick }: ItemCardProps) {
  const nextMile  = getNextMilestone(item);
  const status    = STATUS_CLASSES[item.status];
  const Icon      = STATUS_ICON[item.status];

  return (
    <Item
      style={{ animationDelay: `${Math.min(index, MAX_STAGGER) * 30}ms` }}
      className={cn(
        'relative gap-x-3 rounded-none px-4 py-3 transition-colors hover:bg-muted/50',
        // Item ships with a transparent 1px border on all four sides; colouring
        // just the bottom edge turns it into the rule between rows for free.
        'border-b-border last:border-b-transparent',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:fill-mode-backwards',
        'has-[button:focus-visible]:bg-muted/50 has-[button:focus-visible]:ring-3',
        'has-[button:focus-visible]:ring-ring/50 has-[button:focus-visible]:ring-inset',
      )}
    >
      {/* Stretched hit area — the whole row is the target, without nesting the
          row's own layout inside a button element. */}
      <button type="button" onClick={onClick} className="absolute inset-0 z-10 outline-none">
        <span className="sr-only">Open {item.desc}</span>
      </button>

      <ItemMedia variant="icon" className={cn('size-8 rounded-lg', status.chip)}>
        <Icon className="size-4" />
      </ItemMedia>

      <ItemContent className="min-w-0 gap-1">
        <ItemTitle className="line-clamp-none flex w-full min-w-0 items-center gap-2">
          {groupBy !== 'discipline' && (
            <DisciplineBadge discipline={item.discipline} size="sm" />
          )}
          <span className="truncate">{item.desc}</span>
        </ItemTitle>
        <ItemDescription className="line-clamp-1 text-xs">
          {item.qty} {item.unit} · PO {item.poNo || '—'} · {fmtDate(item.poDate)}
        </ItemDescription>
      </ItemContent>

      {/* Vendor, progress and state each take a column once there is room for
          one; below md they fold onto the footer line rather than disappear. */}
      <ItemContent className="hidden w-36 shrink-0 gap-0.5 md:flex xl:w-44">
        <p className="truncate text-[13px] font-medium">{item.vendor || '—'}</p>
        <p className="truncate text-xs text-muted-foreground">{item.brand || '—'}</p>
      </ItemContent>

      <div className="hidden w-28 shrink-0 md:block xl:w-32">
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium tabular">{item.progress}%</span>
        </div>
        <Progress
          value={item.progress}
          trackClassName="h-1.5"
          indicatorClassName={cn('transition-[width] duration-500', status.rail)}
        />
      </div>

      <div className="hidden w-[7.5rem] shrink-0 flex-col items-end gap-1 md:flex">
        <StatusBadge status={item.status} />
        {nextMile && (
          <span className="w-full truncate text-right text-[11px] text-muted-foreground">
            {nextMile}
          </span>
        )}
      </div>

      <ChevronRight className="size-4 shrink-0 self-center text-muted-foreground/60 transition-transform duration-200 group-hover/item:translate-x-0.5" />

      <ItemFooter className="gap-3 md:hidden">
        <StatusBadge status={item.status} />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Progress
            value={item.progress}
            className="min-w-0 flex-1"
            trackClassName="h-1.5"
            indicatorClassName={cn('transition-[width] duration-500', status.rail)}
          />
          <span className="shrink-0 text-xs font-medium tabular">{item.progress}%</span>
        </div>
      </ItemFooter>
    </Item>
  );
}
