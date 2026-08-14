import { ChevronRight } from 'lucide-react';
import type { ProcurementItem } from '@/types';
import { STATUS_CLASSES, fmtDate, getDisciplineStyle, getNextMilestone } from '@/lib/procurement';
import StatusBadge from './Badge';
import ProgBar from './ProgBar';
import { cn } from '@/lib/utils';

interface ItemCardProps {
  item: ProcurementItem;
  onClick: () => void;
}

export default function ItemCard({ item, onClick }: ItemCardProps) {
  const discStyle = getDisciplineStyle(item.discipline);
  const nextMile = getNextMilestone(item);

  return (
    <button
      onClick={onClick}
      className={cn(
        'group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border-l-[3px]',
        'bg-card px-4 py-3.5 text-left ring-1 ring-foreground/10 transition',
        'hover:ring-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'md:grid-cols-[minmax(0,1fr)_9rem_8rem_7rem_1.25rem]',
        STATUS_CLASSES[item.status].border,
      )}
    >
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
        <ProgBar value={item.progress} indicatorClassName={STATUS_CLASSES[item.status].rail} />
      </div>

      <div className="hidden flex-col items-start gap-1.5 md:flex">
        <StatusBadge status={item.status} />
        {nextMile && <span className="text-[11px] text-muted-foreground">{nextMile}</span>}
      </div>

      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
    </button>
  );
}
