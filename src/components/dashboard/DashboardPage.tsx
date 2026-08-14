'use client';

import { ViewTransition, useMemo, useState, useTransition } from 'react';
import {
  ArrowDownToLine, ArrowUpFromLine, CalendarClock, CheckCircle2, FileWarning,
  PackageSearch, Receipt, Ship, TriangleAlert,
} from 'lucide-react';
import type { Anomaly, ProcurementItem, Project } from '@/types';
import {
  buildLookahead, buildSCurve, computeDeviation, daysDiff, detectAnomalies,
  disciplineBreakdown, fmtDate, getDisciplineStyle, milestoneStats, today, vendorStats,
} from '@/lib/procurement';
import SCurveChart from './SCurveChart';
import StatTile from './StatTile';
import StatusBadge from './Badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card, CardAction, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface DashboardPageProps {
  project: Project | null;
  items: ProcurementItem[];
  onOpenItem: (item: ProcurementItem) => void;
  onImport: () => void;
  onExport: () => void;
  exporting: boolean;
}

const LOOKAHEAD_OPTIONS = [
  { weeks: '4',  label: '4 weeks' },
  { weeks: '8',  label: '8 weeks' },
  { weeks: '13', label: 'Quarter' },
];

/** Icon per anomaly rule, so the list scans without reading every line. */
const ANOMALY_ICON = {
  'milestone-overdue': TriangleAlert,
  'readiness-low-delivery-near': FileWarning,
  'no-po-but-scheduled': Receipt,
  'forecast-slipped': Ship,
  'delivered-no-do': PackageSearch,
} as const;

const MS_ACCENT: Record<string, string> = {
  fat: 'bg-onsite-bg text-onsite-fg',
  rts: 'bg-rts-bg text-rts-fg',
  mos: 'bg-ontrack-bg text-ontrack-fg',
};

export default function DashboardPage({
  project, items, onOpenItem, onImport, onExport, exporting,
}: DashboardPageProps) {
  const [weeks, setWeeks] = useState('4');
  /** Switching the horizon runs in a transition so the grid crossfades. */
  const [, startLookahead] = useTransition();
  const weekCount = Number(weeks);

  const deviation   = useMemo(() => computeDeviation(items, project), [items, project]);
  const curve       = useMemo(() => buildSCurve(items, project), [items, project]);
  const milestones  = useMemo(() => milestoneStats(items), [items]);
  const disciplines = useMemo(() => disciplineBreakdown(items), [items]);
  const lookahead   = useMemo(() => buildLookahead(items, weekCount), [items, weekCount]);
  const anomalies   = useMemo(() => detectAnomalies(items), [items]);
  const vendors     = useMemo(() => vendorStats(items), [items]);

  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const openById = (id: string) => {
    const item = byId.get(id);
    if (item) onOpenItem(item);
  };

  const counts = {
    onsite:  items.filter(i => i.status === 'onsite').length,
    ontrack: items.filter(i => i.status === 'ontrack').length,
    atrisk:  items.filter(i => i.status === 'atrisk').length,
    late:    items.filter(i => i.status === 'late').length,
  };

  const uniqueVendors  = new Set(items.map(i => i.vendor.trim()).filter(Boolean)).size;
  const daysToHandover = project?.handover ? daysDiff(today(), project.handover) : null;

  const topAnomalies = anomalies.slice(0, 6);
  const topVendors   = vendors.slice(0, 5);
  const behind       = deviation.deviation < 0;

  const header = (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          {project?.revision ? (
            <Badge variant="outline" className="tabular">rev.{project.revision}</Badge>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={onImport}>
            <ArrowDownToLine className="size-4" />
            Import Excel
          </Button>
          <Button onClick={onExport} disabled={!items.length || exporting}>
            <ArrowUpFromLine className="size-4" />
            {exporting ? 'Preparing…' : 'Export Excel'}
          </Button>
        </div>
      </div>
    </div>
  );

  if (!items.length) {
    return (
      <div>
        {header}
        <Card className="py-16">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <PackageSearch className="size-9 text-muted-foreground/50" />
            <p className="font-medium">Nothing to summarise yet.</p>
            <Button className="mt-2" onClick={onImport}>
              <ArrowDownToLine className="size-4" />
              Import Excel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {header}

      {/* ── Deviasi + kurva-S ── */}
      <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <Card>
          <CardContent className="flex h-full flex-col">
            <p className={cn(
              'text-[11px] font-semibold uppercase tracking-wider',
              behind ? 'text-atrisk-fg' : 'text-ontrack-fg',
            )}>
              Deviation against plan
            </p>

            <p className={cn(
              'mt-3 text-5xl font-semibold leading-none tracking-tighter tabular',
              behind ? 'text-atrisk-fg' : 'text-ontrack-fg',
            )}>
              {deviation.deviation > 0 ? '+' : deviation.deviation < 0 ? '−' : ''}
              {Math.abs(deviation.deviation)}
              <span className="text-2xl tracking-tight">%</span>
            </p>

            <p className="mt-2.5 text-sm text-muted-foreground">
              {behind ? (
                <>
                  Actual is behind the planned curve
                  {deviation.slipDays > 0 && (
                    <> — roughly <span className="font-medium text-foreground">{deviation.slipDays} days</span> behind</>
                  )}.
                </>
              ) : deviation.deviation > 0
                ? 'Actual is ahead of plan. Schedule is healthy.'
                : 'Actual sits exactly on the planned curve.'}
            </p>

            <Separator className="my-5" />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Planned</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-muted-foreground tabular">
                  {deviation.planPct}%
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actual</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight tabular">{deviation.actualPct}%</p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              <Bar label="Plan" value={deviation.planPct} className="bg-muted-foreground/60" />
              <Bar label="Act"  value={deviation.actualPct} className="bg-onsite" />
            </div>

            {project?.handover && (
              <p className="mt-auto pt-5 text-xs text-muted-foreground">
                Handover target <span className="font-medium text-foreground">{fmtDate(project.handover)}</span>
                {daysToHandover !== null && (
                  daysToHandover >= 0
                    ? ` · ${daysToHandover} days left`
                    : ` · ${Math.abs(daysToHandover)} days overdue`
                )}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>S-Curve · Plan vs Actual</CardTitle>
            <CardAction className="hidden gap-4 sm:flex">
              <Legend swatch="bg-muted-foreground" label="Plan" />
              <Legend swatch="bg-onsite" label="Actual" />
              <Legend swatch="bg-rts" label="Forecast" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <SCurveChart points={curve} />
          </CardContent>
        </Card>
      </div>

      {/* ── Tiles ── */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="Total items" value={items.length}
          sub={`${disciplines.length} disciplines · ${uniqueVendors} vendors`} variant="accent"
        />
        <StatTile
          label="On Site" value={counts.onsite}
          sub={`${Math.round((counts.onsite / items.length) * 100)}% delivered`}
          variant={counts.onsite > 0 ? 'good' : 'default'}
        />
        <StatTile label="On Track" value={counts.ontrack} sub="On schedule" />
        <StatTile
          label="At Risk" value={counts.atrisk} sub="FAT within 14 days"
          variant={counts.atrisk > 0 ? 'warn' : 'default'}
        />
        <StatTile
          label="Late" value={counts.late} sub="Overdue"
          variant={counts.late > 0 ? 'crit' : 'default'}
        />
      </div>

      {/* ── Milestone + disiplin ── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Milestone position</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {milestones.map(ms => {
              const pct = (n: number) => (ms.total ? (n / ms.total) * 100 : 0);
              return (
                <div key={ms.key} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide', MS_ACCENT[ms.key])}>
                        {ms.label}
                      </span>
                      <span className="text-muted-foreground">{ms.name}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular">
                      {ms.done}<span className="font-normal text-muted-foreground"> / {ms.total}</span>
                    </span>
                  </div>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="bg-ontrack" style={{ width: `${pct(ms.done)}%` }} />
                    <div className="bg-atrisk"  style={{ width: `${pct(ms.scheduled)}%` }} />
                    <div className="bg-late"    style={{ width: `${pct(ms.overdue)}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <Key swatch="bg-ontrack" label="Done" n={ms.done} />
                    <Key swatch="bg-atrisk" label="Scheduled" n={ms.scheduled} />
                    <Key swatch="bg-late" label="Overdue" n={ms.overdue} />
                    {ms.unplanned > 0 && (
                      <Key swatch="bg-muted-foreground/40" label="Not scheduled" n={ms.unplanned} />
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Breakdown by discipline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {disciplines.map(d => {
                const style = getDisciplineStyle(d.discipline);
                const w = (n: number) => (d.total ? (n / d.total) * 100 : 0);
                return (
                  <div key={d.discipline} className="grid grid-cols-[5.75rem_minmax(0,1fr)_2rem] items-center gap-2.5">
                    <span
                      className="truncate rounded px-2 py-0.5 text-center text-[11px] font-semibold"
                      style={{ background: style.bg, color: style.color }}
                    >
                      {d.discipline}
                    </span>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                      <div className="bg-onsite"   style={{ width: `${w(d.counts.onsite)}%` }} />
                      <div className="bg-ontrack"  style={{ width: `${w(d.counts.ontrack)}%` }} />
                      <div className="bg-atrisk"   style={{ width: `${w(d.counts.atrisk)}%` }} />
                      <div className="bg-late"     style={{ width: `${w(d.counts.late)}%` }} />
                      <div className="bg-planning" style={{ width: `${w(d.counts.planning)}%` }} />
                    </div>
                    <span className="text-right text-xs font-semibold text-muted-foreground tabular">{d.total}</span>
                  </div>
                );
              })}
            </div>

            <Separator className="my-4" />

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
              <Key swatch="bg-onsite" label="On Site" />
              <Key swatch="bg-ontrack" label="On Track" />
              <Key swatch="bg-atrisk" label="At Risk" />
              <Key swatch="bg-late" label="Late" />
              <Key swatch="bg-planning" label="Planning" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Lookahead ── */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Falling due next</CardTitle>
          <CardAction>
            <Tabs value={weeks} onValueChange={v => startLookahead(() => setWeeks(v))}>
              <TabsList>
                {LOOKAHEAD_OPTIONS.map(o => (
                  <TabsTrigger key={o.weeks} value={o.weeks}>{o.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ViewTransition key={weeks} name="lookahead" share="auto" enter="auto" exit="auto" default="none">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {lookahead.slice(0, 4).map((week, wi) => (
              <div
                key={week.label}
                style={{ animationDelay: `${wi * 45}ms` }}
                className={cn(
                  'min-h-36 rounded-xl border p-3',
                  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-backwards',
                  week.isCurrent ? 'border-onsite/30 bg-onsite-bg/60' : 'bg-muted/40',
                )}
              >
                <div className="mb-2.5 flex items-baseline justify-between gap-2">
                  <span className={cn(
                    'text-[11px] font-bold uppercase tracking-wider',
                    week.isCurrent ? 'text-onsite-fg' : 'text-muted-foreground',
                  )}>
                    {week.label}
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold text-muted-foreground tabular">
                    {week.range}
                  </span>
                </div>

                {week.events.length === 0 ? (
                  <p className="px-0.5 py-2 text-[11px] italic text-muted-foreground">Nothing scheduled.</p>
                ) : (
                  <div className="space-y-1.5">
                    {week.events.slice(0, 6).map(ev => (
                      <button
                        key={`${ev.itemId}-${ev.kind}`}
                        onClick={() => openById(ev.itemId)}
                        className={cn(
                          'block w-full rounded-lg border-l-[3px] bg-card px-2.5 py-2 text-left ring-1 ring-foreground/5',
                          'transition-all duration-200 hover:-translate-y-px hover:shadow-sm hover:ring-foreground/20',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          ev.overdue ? 'border-l-late bg-late-bg'
                            : ev.kind === 'fat' ? 'border-l-onsite'
                            : ev.kind === 'rts' ? 'border-l-rts'
                            : 'border-l-ontrack',
                        )}
                      >
                        <span className="mb-1 flex items-center gap-1.5">
                          <span className={cn(
                            'rounded px-1.5 py-px text-[9px] font-bold tracking-wide',
                            ev.overdue ? 'bg-late/15 text-late-fg' : MS_ACCENT[ev.kind],
                          )}>
                            {ev.label}
                          </span>
                          <span className={cn(
                            'ml-auto text-[9px] font-bold tabular',
                            ev.overdue ? 'text-late-fg' : 'text-muted-foreground',
                          )}>
                            {ev.overdue ? 'OVERDUE' : ev.day}
                          </span>
                        </span>
                        <span className="block text-xs font-medium leading-snug">{ev.desc}</span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">{ev.vendor || '—'}</span>
                      </button>
                    ))}
                    {week.events.length > 6 && (
                      <p className="px-0.5 pt-1 text-[11px] italic text-muted-foreground">
                        +{week.events.length - 6} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          </ViewTransition>

          {weekCount > 4 && (
            <p className="mt-4 text-xs text-muted-foreground">
              Showing the first 4 of {weekCount} weeks.{' '}
              {lookahead.slice(4).reduce((s, w) => s + w.events.length, 0)} further milestones fall due after that.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Anomali ── */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Detected anomalies</CardTitle>
          <CardAction>
            <Badge variant="secondary" className="tabular">{anomalies.length} findings</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {anomalies.length === 0 ? (
            <Alert className="border-ontrack/25 bg-ontrack-bg text-ontrack-fg">
              <CheckCircle2 />
              <AlertTitle>No anomalies</AlertTitle>
              <AlertDescription className="text-ontrack-fg/80">
                Every item has a sensible schedule and complete documents.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              {topAnomalies.map((a, idx) => (
                <AnomalyRow
                  key={`${a.itemId}-${a.rule}-${idx}`}
                  anomaly={a}
                  item={byId.get(a.itemId)}
                  index={idx}
                  onOpen={openById}
                />
              ))}
              {anomalies.length > topAnomalies.length && (
                <p className="pt-1 text-xs text-muted-foreground">
                  +{anomalies.length - topAnomalies.length} more findings. All of them are written to
                  the <span className="font-medium text-foreground">ANOMALIES</span> sheet on export.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Vendor ── */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Vendors needing follow-up</CardTitle>
          <CardAction>
            <Badge variant="secondary" className="tabular">{vendors.length} vendors</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-44">Vendor</TableHead>
                  <TableHead className="w-16">Item</TableHead>
                  <TableHead className="w-32">Readiness</TableHead>
                  <TableHead className="w-28">Avg. slip</TableHead>
                  <TableHead className="w-28 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topVendors.map((v, vi) => {
                  const pct = Math.round(v.avgReadiness * 100);
                  return (
                    <TableRow
                      key={v.vendor}
                      style={{ animationDelay: `${vi * 40}ms` }}
                      className="motion-safe:animate-in motion-safe:fade-in motion-safe:fill-mode-backwards"
                    >
                      <TableCell>
                        <p className="font-medium">{v.vendor}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {v.itemNames.slice(0, 3).join(' · ')}
                        </p>
                      </TableCell>
                      <TableCell className="font-medium tabular">{v.items}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                'h-full rounded-full transition-[width] duration-500',
                                pct < 50 ? 'bg-late' : pct < 90 ? 'bg-atrisk' : 'bg-ontrack',
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium tabular">{pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className={cn('text-xs font-medium tabular', v.avgSlipDays > 0 && 'text-late-fg')}>
                        {v.avgSlipDays > 0 ? `+${v.avgSlipDays} days` : 'on time'}
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusBadge status={v.worstStatus} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────── Sub-components ─────────────── */

function Bar({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-9 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', className)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span className={cn('h-[3px] w-3.5 rounded-full', swatch)} />
      {label}
    </span>
  );
}

function Key({ swatch, label, n }: { swatch: string; label: string; n?: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('size-[7px] rounded-[2px]', swatch)} />
      {label}
      {n !== undefined && <b className="font-bold text-foreground tabular">{n}</b>}
    </span>
  );
}

function AnomalyRow({
  anomaly, item, index, onOpen,
}: {
  anomaly: Anomaly;
  item: ProcurementItem | undefined;
  index: number;
  onOpen: (id: string) => void;
}) {
  const Icon = ANOMALY_ICON[anomaly.rule] ?? TriangleAlert;
  const crit = anomaly.severity === 'crit';

  return (
    <Alert
      style={{ animationDelay: `${index * 40}ms` }}
      className={cn(
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-backwards',
        crit
          ? 'border-late/20 bg-late-bg text-late-fg'
          : 'border-atrisk/25 bg-atrisk-bg text-atrisk-fg',
      )}
    >
      <Icon />
      <AlertTitle className="text-foreground">
        {item?.desc ?? 'Item not found'}
        {item?.vendor && (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">· {item.vendor}</span>
        )}
        {item?.poNo && (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">· {item.poNo}</span>
        )}
      </AlertTitle>
      <AlertDescription className={crit ? 'text-late-fg' : 'text-atrisk-fg'}>
        {anomaly.detail}
      </AlertDescription>
      {item && (
        <Button
          size="sm"
          variant="ghost"
          className="col-start-2 row-start-3 mt-2 justify-self-start bg-background/70 transition-colors hover:bg-background"
          onClick={() => onOpen(anomaly.itemId)}
        >
          <CalendarClock className="size-3.5" />
          Open item
        </Button>
      )}
    </Alert>
  );
}
