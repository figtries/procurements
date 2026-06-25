import type { MilestoneEntry } from '@/types';
import { fmtDate, milestoneState } from '@/lib/utils';

interface MilestoneRowProps {
  name: string;
  ms: MilestoneEntry;
  index: number;
}

export default function MilestoneRow({ name, ms, index }: MilestoneRowProps) {
  const state = milestoneState(ms);
  const dotClass =
    state === 'done'    ? 'tl-dot tl-done' :
    state === 'late'    ? 'tl-dot tl-late' :
    state === 'current' ? 'tl-dot tl-current' :
                          'tl-dot tl-upcoming';
  const num = index + 1;

  return (
    <div className="tl-step">
      <div className={dotClass}>
        {state === 'done' ? '✓' : state === 'late' ? '!' : num}
      </div>
      <div className="tl-body">
        <div className="tl-name">{name}</div>
        <div className="tl-pills">
          {ms.plan && (
            <span className={`tl-pill${ms.actual && ms.actual > ms.plan ? ' slip' : ms.actual ? ' done' : ''}`}>
              <span className="tl-key">Plan</span>
              <span className="tl-val">{fmtDate(ms.plan)}</span>
            </span>
          )}
          {ms.forecast && ms.forecast !== ms.plan && (
            <span className="tl-pill slip">
              <span className="tl-key">Forecast</span>
              <span className="tl-val">{fmtDate(ms.forecast)}</span>
            </span>
          )}
          {ms.actual && (
            <span className="tl-pill done">
              <span className="tl-key">Actual</span>
              <span className="tl-val">{fmtDate(ms.actual)}</span>
            </span>
          )}
          {!ms.plan && !ms.forecast && !ms.actual && (
            <span className="tl-empty">No dates set</span>
          )}
        </div>
        {ms.note && <div className="tl-note">{ms.note}</div>}
      </div>
    </div>
  );
}
