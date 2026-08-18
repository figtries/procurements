'use client';

import { ArrowDown, ArrowUp, Check, Pencil, Upload } from 'lucide-react';
import type { ItemEvent } from '@/types';
import { describeEvent, groupEventsByDay, type EventTone } from '@/lib/itemLog';
import { fmtDate } from '@/lib/procurement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/* An item's history, read top-down: what moved, when, and who said so.
   Hand edits and vendor imports share the list, because "who moved this
   date" is the question being asked, not "which route did it arrive by". */

const TONE: Record<EventTone, { dot: string; text?: string; icon: typeof Check }> = {
  slip: { dot: 'bg-atrisk-bg text-atrisk-fg', text: 'text-atrisk-fg', icon: ArrowDown },
  gain: { dot: 'bg-ok-bg text-ok-fg', icon: ArrowUp },
  done: { dot: 'bg-ok-bg text-ok-fg', icon: Check },
  info: { dot: 'bg-muted text-muted-foreground', icon: Pencil },
};

const SOURCE_LABEL: Record<ItemEvent['source'], string> = {
  'vendor-import': 'from vendor form',
  'own-import': 'from Excel import',
  manual: 'edited here',
  created: 'created',
};

export default function UpdateLog({ events }: { events: ItemEvent[] }) {
  const days = groupEventsByDay(events ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Log</CardTitle>
      </CardHeader>
      <CardContent>
        {days.length === 0 ? (
          <p className="rounded-lg bg-muted/60 px-3.5 py-3 text-sm text-muted-foreground">
            Nothing recorded yet. Edits made here and progress imported from a vendor
            form both show up in this list.
          </p>
        ) : (
          <ol className="space-y-5">
            {days.map(({ day, events: sameDay }) => (
              <li key={day}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground tabular">
                  {fmtDate(day)}
                </p>
                <ul className="space-y-2.5">
                  {sameDay.map((event, i) => {
                    const line = describeEvent(event);
                    const tone = TONE[line.tone];
                    const Icon = event.source === 'vendor-import' && line.tone === 'info'
                      ? Upload
                      : tone.icon;
                    return (
                      <li key={`${event.at}-${event.field}-${i}`} className="flex gap-2.5">
                        <span
                          className={cn(
                            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
                            '[&>svg]:size-3',
                            tone.dot,
                          )}
                        >
                          <Icon />
                        </span>
                        <div className="min-w-0">
                          <p className={cn('text-sm leading-snug', tone.text)}>
                            {line.headline}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {event.actor}
                            {' · '}
                            {SOURCE_LABEL[event.source]}
                          </p>
                          {event.reason && (
                            <p className="mt-1 border-l-2 pl-2.5 text-[12.5px] italic leading-snug text-muted-foreground">
                              {event.reason}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
