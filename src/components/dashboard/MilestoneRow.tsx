import { Check, TriangleAlert } from 'lucide-react';
import type { MilestoneEntry } from '@/types';
import { fmtDate, milestoneState } from '@/lib/procurement';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MilestoneRowProps {
  name: string;
  ms: MilestoneEntry;
  index: number;
  last?: boolean;
}

/* A cleared step is green and the one in play is blue, said with the
   semantic pair rather than with two status colours that happen to be
   those hues today. */
const DOT: Record<string, string> = {
  done:     'bg-ok text-white',
  late:     'bg-late text-white ring-4 ring-late-bg',
  current:  'bg-info text-white ring-4 ring-info-bg',
  upcoming: 'bg-muted text-muted-foreground',
};

const PILL_TONE = {
  done:  'bg-ok-bg text-ok-fg',
  slip:  'bg-atrisk-bg text-atrisk-fg',
  muted: 'bg-muted text-muted-foreground',
} as const;

/** One step of the FAT → RTS → MOS timeline. */
export default function MilestoneRow({ name, ms, index, last }: MilestoneRowProps) {
  const state = milestoneState(ms);
  const slipped = !!ms.actual && !!ms.plan && ms.actual > ms.plan;

  return (
    <div className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-4 pb-6 last:pb-0">
      {!last && <span className="absolute top-9 bottom-[-0.25rem] left-[1.0625rem] w-px bg-border" />}

      <span className={cn(
        'z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
        DOT[state],
      )}>
        {state === 'done' ? <Check className="size-4" strokeWidth={3} />
          : state === 'late' ? <TriangleAlert className="size-4" />
          : index + 1}
      </span>

      <div className="pt-1">
        <p className="text-sm font-medium">{name}</p>

        <div className="mt-2.5 flex flex-wrap gap-2">
          {ms.plan && (
            <DatePill
              label="Plan" value={fmtDate(ms.plan)}
              tone={slipped ? 'slip' : ms.actual ? 'done' : 'muted'}
            />
          )}
          {ms.forecast && ms.forecast !== ms.plan && (
            <DatePill label="Forecast" value={fmtDate(ms.forecast)} tone="slip" />
          )}
          {ms.actual && <DatePill label="Actual" value={fmtDate(ms.actual)} tone="done" />}
          {!ms.plan && !ms.forecast && !ms.actual && (
            <span className="text-xs text-muted-foreground italic">No dates set.</span>
          )}
        </div>

        {ms.note && (
          <p className="mt-2.5 rounded-md border-l-2 bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {ms.note}
          </p>
        )}
      </div>
    </div>
  );
}

function DatePill({
  label, value, tone,
}: { label: string; value: string; tone: keyof typeof PILL_TONE }) {
  return (
    <Badge
      variant="secondary"
      className={cn('h-auto gap-1.5 rounded-md border-transparent px-2 py-1 tabular', PILL_TONE[tone])}
    >
      <span className="text-[10px] font-bold tracking-wide uppercase opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </Badge>
  );
}
