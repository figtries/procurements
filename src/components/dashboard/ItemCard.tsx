import { ChevronRight } from 'lucide-react';
import type { ProcurementItem } from '@/types';
import { STATUS_CLASSES, fmtDate, getDisciplineStyle, getNextMilestone } from '@/lib/procurement';
import StatusBadge from './Badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ItemCardProps {
  item: ProcurementItem;
  /** Position in its group, used to stagger the entry animation. */
  index?: number;
  onClick: () => void;
}

/** Cap the stagger so long lists do not crawl in. */
const MAX_STAGGER = 8;

export default function ItemCard({ item, index = 0, onClick }: ItemCardProps) {
  const discStyle = getDisciplineStyle(item.discipline);
  const nextMile = getNextMilestone(item);

  return (
    <Card
      size="sm"
      style={{ animationDelay: `${Math.min(index, MAX_STAGGER) * 35}ms` }}
      className={cn(
        'group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 border-l-[3px] px-3.5 py-3 sm:px-4',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-backwards',
        'transition-shadow duration-200 hover:shadow-sm hover:ring-foreground/25',
        'has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-ring',
        'md:grid-cols-[minmax(0,1fr)_9rem_8rem_7rem_1.25rem]',
        STATUS_CLASSES[item.status].border,
      )}
    >
      {/* Stretched hit area — keeps the whole row clickable without nesting
          interactive content inside a button. */}
      <button
        type="button"
        onClick={onClick}
        className="absolute inset-0 z-10 rounded-xl outline-none"
      >
        <span className="sr-only">Open {item.desc}</span>
      </button>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          <span
            className="mr-2 inline-block rounded px-1.5 py-0.5 align-[1px] text-[10px] font-bold"
            style={{ background: discStyle.bg, color: discStyle.color }}
          >
            {item.discipline}
          </span>
          {item.desc}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {item.qty} {item.unit} · PO: {item.poNo || '—'} · {fmtDate(item.poDate)}
        </p>
      </div>

      <div className="hidden min-w-0 md:block">
        <p className="truncate text-[13px] font-medium">{item.vendor || '—'}</p>
        {item.brand && <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.brand}</p>}
      </div>

      <div className="hidden md:block">
        <div className="mb-1.5 flex justify-between text-xs font-medium">
          <span className="text-muted-foreground">Progress</span>
          <span className="tabular">{item.progress}%</span>
        </div>
        <Progress
          value={item.progress}
          indicatorClassName={cn('transition-[width] duration-500', STATUS_CLASSES[item.status].rail)}
        />
      </div>

      <div className="hidden flex-col items-start gap-1.5 md:flex">
        <StatusBadge status={item.status} />
        {nextMile && <span className="text-[11px] text-muted-foreground">{nextMile}</span>}
      </div>

      <ChevronRight className="size-4 shrink-0 self-center text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />

      {/* Phone: status, vendor and progress fold onto a second line rather
          than disappearing — the schedule state is the whole point of the row. */}
      <div className="col-span-2 md:hidden">
        <div className="mb-1.5 flex items-center gap-2">
          <StatusBadge status={item.status} />
          <span className="truncate text-xs text-muted-foreground">{item.vendor || '—'}</span>
          <span className="ml-auto shrink-0 text-xs font-medium tabular">{item.progress}%</span>
        </div>
        <Progress
          value={item.progress}
          trackClassName="h-1.5"
          indicatorClassName={cn('transition-[width] duration-500', STATUS_CLASSES[item.status].rail)}
        />
      </div>
    </Card>
  );
}
