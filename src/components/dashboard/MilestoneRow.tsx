import { Check, TriangleAlert } from 'lucide-react';
import type { MilestoneEntry } from '@/types';
import { fmtDate, milestoneState } from '@/lib/procurement';
import { cn } from '@/lib/utils';

interface MilestoneRowProps {
  name: string;
  ms: MilestoneEntry;
  index: number;
  last?: boolean;
}

const DOT: Record<string, string> = {
  done:     'bg-ontrack text-white',
  late:     'bg-late text-white ring-4 ring-late-bg',
  current:  'bg-onsite text-white ring-4 ring-onsite-bg',
  upcoming: 'bg-muted text-muted-foreground',
};

/** One step of the FAT → RTS → MOS timeline. */
export default function MilestoneRow({ name, ms, index, last }: MilestoneRowProps) {
  const state = milestoneState(ms);
  const slipped = !!ms.actual && !!ms.plan && ms.actual > ms.plan;

  return (
    <div className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-4 pb-6 last:pb-0">
      {!last && <span className="absolute left-[1.0625rem] top-9 bottom-[-0.25rem] w-px bg-border" />}

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
            <Pill
              label="Plan" value={fmtDate(ms.plan)}
              tone={slipped ? 'slip' : ms.actual ? 'done' : 'muted'}
            />
          )}
          {ms.forecast && ms.forecast !== ms.plan && (
            <Pill label="Forecast" value={fmtDate(ms.forecast)} tone="slip" />
          )}
          {ms.actual && <Pill label="Actual" value={fmtDate(ms.actual)} tone="done" />}
          {!ms.plan && !ms.forecast && !ms.actual && (
            <span className="text-xs italic text-muted-foreground">No dates set.</span>
          )}
        </div>

        {ms.note && (
          <p className="mt-2.5 rounded-md border-l-2 border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {ms.note}
          </p>
        )}
      </div>
    </div>
  );
}

function Pill({ label, value, tone }: { label: string; value: string; tone: 'done' | 'slip' | 'muted' }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs tabular',
      tone === 'done' ? 'bg-ontrack-bg text-ontrack-fg'
        : tone === 'slip' ? 'bg-atrisk-bg text-atrisk-fg'
        : 'bg-muted text-muted-foreground',
    )}>
      <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}
