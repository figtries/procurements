import { memo, useCallback } from 'react';
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
  /** The heading already names whatever the list is grouped on, so the row
   *  does not repeat it. */
  groupBy?: GroupBy;
  /** Whether this row is being drawn in its wide form.
   *
   *  Read once for the whole list and handed down rather than asked for by
   *  each row: one media query answers for all eighty-eight of them. The
   *  classes below still carry their own `md:` rules, so the breakpoint, not
   *  this flag, remains what decides whether a thing is seen — the flag only
   *  decides whether it is built. */
  wide?: boolean;
  /** Takes the item rather than a closure over it: a fresh arrow written at
   *  the call site would be a new prop on every render of the list, and the
   *  memo below would never once hold. */
  onOpen: (item: ProcurementItem) => void;
}

/** One glyph per schedule state — the row reads before any of its text does. */
const STATUS_ICON: Record<ItemStatus, LucideIcon> = {
  planning: CircleDashed,
  ontrack:  TrendingUp,
  atrisk:   Clock,
  late:     TriangleAlert,
  onsite:   PackageCheck,
};

/**
 * Class merges that never vary, done once for the module instead of once per
 * row per render.
 *
 * `cn` reads every class it is handed to decide which of them win, which is
 * cheap on its own and adds up over a list — the overview mounts near ninety
 * of these rows, and each one used to run four of these merges every time it
 * rendered, always to the same answer. The row's own classes are literals,
 * and there are five statuses, so both sets can be settled up front.
 */
const ROW = cn(
  'relative gap-x-3 rounded-none px-4 py-3 transition-colors hover:bg-muted/50',
  // Item ships with a transparent 1px border on all four sides; colouring
  // just the bottom edge turns it into the rule between rows for free.
  'border-b-border last:border-b-transparent',
  'has-[button:focus-visible]:bg-muted/50 has-[button:focus-visible]:ring-3',
  'has-[button:focus-visible]:ring-ring/50 has-[button:focus-visible]:ring-inset',
);

const STATUS_STYLE = Object.fromEntries(
  Object.entries(STATUS_CLASSES).map(([status, s]) => [status, {
    chip: cn('size-8 rounded-lg', s.chip),
    rail: cn('transition-[width] duration-500', s.rail),
  }]),
) as Record<ItemStatus, { chip: string; rail: string }>;

function ItemCard({ item, groupBy, wide, onOpen }: ItemCardProps) {
  const nextMile  = getNextMilestone(item);
  const status    = STATUS_STYLE[item.status];
  const Icon      = STATUS_ICON[item.status];

  /** Stable for as long as the row is showing the same item, so the memo
   *  below has something to hold on to. */
  const open = useCallback(() => onOpen(item), [onOpen, item]);

  const row = (
    <Item className={ROW}>
      {/* Stretched hit area — the whole row is the target, without nesting the
          row's own layout inside a button element. */}
      <button type="button" onClick={open} className="absolute inset-0 z-10 outline-none">
        <span className="sr-only">Open {item.desc}</span>
      </button>

      <ItemMedia variant="icon" className={status.chip}>
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
          one; below md they fold onto the footer line rather than disappear.
          Only one of the two arrangements is built. Both used to be, and the
          unused one was fifteen nodes of every row — near a thousand across
          the list — created, styled and kept for a width that was not on the
          screen. */}
      {wide && (<>
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
          indicatorClassName={status.rail}
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
      </>)}

      <ChevronRight className="size-4 shrink-0 self-center text-muted-foreground/60 transition-transform duration-200 group-hover/item:translate-x-0.5" />

      {!wide && (
      <ItemFooter className="gap-3 md:hidden">
        <StatusBadge status={item.status} />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Progress
            value={item.progress}
            className="min-w-0 flex-1"
            trackClassName="h-1.5"
            indicatorClassName={status.rail}
          />
          <span className="shrink-0 text-xs font-medium tabular">{item.progress}%</span>
        </div>
      </ItemFooter>
      )}
    </Item>
  );

  return row;
}

/**
 * Memoised, and the pager is the reason.
 *
 * Turning a group to its next page is one piece of state changing in the card
 * above — and without this, every row of every page of that group renders
 * again to produce exactly what is already on screen, on the same thread
 * embla is using to animate the slide. Eleven rows for Mechanical alone, each
 * a fistful of class merges and date formatting, all landing in the frames
 * where the movement starts. That was the weight on the arrow.
 */
export default memo(ItemCard);
