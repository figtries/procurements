'use client';

import { ViewTransition, useMemo, useState, useTransition } from 'react';
import {
  ArrowDownToLine, CalendarClock, CheckCircle2, FileWarning,
  PackageSearch, Receipt, Ship, TriangleAlert,
} from 'lucide-react';
import type { Anomaly, ProcurementItem, Project } from '@/types';
import {
  buildLookahead, buildSCurve, computeDeviation, daysDiff, detectAnomalies,
  disciplineBreakdown, fmtDate, milestoneStats, today, vendorStats,
} from '@/lib/procurement';
import SCurveChart from './SCurveChart';
import StatTile from './StatTile';
import StatusBadge from './Badge';
import DisciplineBadge from './DisciplineBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card, CardAction, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
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

/* The three milestones read as a journey: FAT is the checkpoint you are
   working towards, RTS the crossing, MOS the arrival — so the last one is
   the green. These are the semantic hues, not the status ones; a milestone
   kind is not a schedule state. */
const MS_ACCENT: Record<string, string> = {
  fat: 'bg-info-bg text-info-fg',
  rts: 'bg-rts-bg text-rts-fg',
  mos: 'bg-ok-bg text-ok-fg',
};

/** Readiness rail colour — shared by the vendor table and its phone stack. */
function readinessTone(pct: number) {
  return pct < 50 ? 'bg-late' : pct < 90 ? 'bg-atrisk' : 'bg-ok';
}

export default function DashboardPage({
  project, items, onOpenItem, onImport,
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
    <div className="mb-5 sm:mb-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
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

      {/* ── Deviasi + kurva-S ──
          Side by side only from xl: at lg the sidebar has already claimed
          16rem, and splitting what is left would squeeze the curve into a
          box too narrow to read. */}
      <div className="grid gap-3 sm:gap-4 xl:grid-cols-[16.5rem_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Deviation against Plan</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col">
            <p className={cn(
              'text-3xl font-semibold leading-none tracking-tight tabular sm:text-4xl',
              behind ? 'text-late' : 'text-ok',
            )}>
              {deviation.deviation > 0 ? '+' : deviation.deviation < 0 ? '−' : ''}
              {Math.abs(deviation.deviation)}
              <span className="text-xl">%</span>
            </p>

            <p className="mt-2.5 text-sm text-muted-foreground">
              {behind ? (
                <>
                  Actual is behind the planned curve
                  {deviation.slipDays > 0 && (
                    <> roughly <span className="font-medium text-foreground">{deviation.slipDays} days</span> behind</>
                  )}.
                </>
              ) : deviation.deviation > 0
                ? 'Actual is ahead of plan. Schedule is healthy.'
                : 'Actual sits exactly on the planned curve.'}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Planned</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-muted-foreground tabular">
                  {deviation.planPct}%
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actual</p>
                <p className="mt-1 text-xl font-semibold tracking-tight tabular">{deviation.actualPct}%</p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              <Bar label="Plan" value={deviation.planPct} className="bg-late" />
              <Bar label="Act"  value={deviation.actualPct} className="bg-info" />
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
          <CardHeader className="max-sm:grid-cols-1!">
            <CardTitle>S-Curve · Plan vs Actual</CardTitle>
            {/* On a phone the legend drops below the title rather than
                competing with it for the same row. */}
            <CardAction className="flex flex-wrap gap-x-4 gap-y-1.5 max-sm:col-start-1 max-sm:row-start-2 max-sm:mt-2 max-sm:justify-self-start">
              <Legend swatch="bg-late" label="Plan" />
              <Legend swatch="bg-info" label="Actual" />
              <Legend swatch="bg-ok" label="Forecast" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <SCurveChart points={curve} />
          </CardContent>
        </Card>
      </div>

      {/* ── Tiles ──
          Five tiles never divide evenly into two columns, so on a phone the
          total takes the full width and the four statuses pair off below it. */}
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-4 sm:gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile
          className="col-span-2 md:col-span-1"
          label="Total items" value={items.length}
          sub={`${disciplines.length} disciplines · ${uniqueVendors} vendors`}
        />
        <StatTile
          label="On Site" value={counts.onsite}
          sub={`${Math.round((counts.onsite / items.length) * 100)}% delivered`}
          tone="onsite" active={counts.onsite > 0}
        />
        <StatTile
          label="On Track" value={counts.ontrack} sub="On schedule"
          tone="ontrack" active={counts.ontrack > 0}
        />
        <StatTile
          label="At Risk" value={counts.atrisk} sub="FAT within 14 days"
          tone="atrisk" active={counts.atrisk > 0}
        />
        <StatTile
          label="Late" value={counts.late} sub="Overdue"
          tone="late" active={counts.late > 0}
        />
      </div>

      {/* ── Milestone + disiplin ── */}
      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 xl:grid-cols-[1.25fr_minmax(0,1fr)]">
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
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide', MS_ACCENT[ms.key])}>
                        {ms.label}
                      </span>
                      <span className="truncate text-muted-foreground">{ms.name}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular">
                      {ms.done}<span className="font-normal text-muted-foreground"> / {ms.total}</span>
                    </span>
                  </div>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="bg-ok" style={{ width: `${pct(ms.done)}%` }} />
                    <div className="bg-atrisk"  style={{ width: `${pct(ms.scheduled)}%` }} />
                    <div className="bg-late"    style={{ width: `${pct(ms.overdue)}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <Key swatch="bg-ok" label="Done" n={ms.done} />
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
          {/* Same two-line rhythm as the milestone card beside it: a labelled
              row, then its bar — which also lets the rows fill the card. */}
          <CardContent className="flex h-full flex-col">
            <div className="flex flex-1 flex-col justify-evenly gap-3">
              {disciplines.map(d => {
                const w = (n: number) => (d.total ? (n / d.total) * 100 : 0);
                return (
                  <div key={d.discipline} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <DisciplineBadge discipline={d.discipline} className="min-w-0 truncate" />
                      <span className="shrink-0 text-sm font-semibold tabular">
                        {d.total}
                        <span className="font-normal text-muted-foreground">
                          {' '}item{d.total === 1 ? '' : 's'}
                        </span>
                      </span>
                    </div>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                      <div className="bg-onsite"   style={{ width: `${w(d.counts.onsite)}%` }} />
                      <div className="bg-ontrack"  style={{ width: `${w(d.counts.ontrack)}%` }} />
                      <div className="bg-atrisk"   style={{ width: `${w(d.counts.atrisk)}%` }} />
                      <div className="bg-late"     style={{ width: `${w(d.counts.late)}%` }} />
                      <div className="bg-planning" style={{ width: `${w(d.counts.planning)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
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
      <Card className="mt-3 sm:mt-4">
        <CardHeader className="max-sm:grid-cols-1!">
          <CardTitle>Falling due next</CardTitle>
          {/* Full-width segmented control on a phone: the three horizons
              would otherwise crowd the title off its own row. */}
          <CardAction className="max-sm:col-start-1 max-sm:row-start-2 max-sm:mt-3 max-sm:w-full">
            <Tabs value={weeks} onValueChange={v => startLookahead(() => setWeeks(v))}>
              <TabsList className="max-sm:w-full">
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
                  week.isCurrent ? 'border-info/30 bg-info-bg/60' : 'bg-muted/40',
                )}
              >
                <div className="mb-2.5 flex items-baseline justify-between gap-2">
                  <span className={cn(
                    'text-[11px] font-bold uppercase tracking-wider',
                    week.isCurrent ? 'text-info-fg' : 'text-muted-foreground',
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
                            : ev.kind === 'fat' ? 'border-l-info'
                            : ev.kind === 'rts' ? 'border-l-rts'
                            : 'border-l-ok',
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
      <Card className="mt-3 sm:mt-4">
        <CardHeader>
          <CardTitle>Detected anomalies</CardTitle>
          <CardAction>
            <Badge variant="secondary" className="tabular">{anomalies.length} findings</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {anomalies.length === 0 ? (
            <Alert className="border-ok/25 bg-ok-bg text-ok-fg">
              <CheckCircle2 />
              <AlertTitle>No anomalies</AlertTitle>
              <AlertDescription className="text-ok-fg/80">
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
      <Card className="mt-3 sm:mt-4">
        <CardHeader className="border-b">
          <CardTitle>Vendor Watchlist</CardTitle>
          <CardAction>
            <Badge variant="secondary" className="tabular">{vendors.length} vendors</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {/* Phone: the same five figures stacked. A five-column table on a
              360px screen is a sideways scroll and nothing else. */}
          <div className="divide-y md:hidden">
            {topVendors.map(v => {
              const pct = Math.round(v.avgReadiness * 100);
              return (
                <div key={v.vendor} className="space-y-2.5 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{v.vendor}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {v.items} item{v.items === 1 ? '' : 's'} · {v.itemNames.slice(0, 2).join(' · ')}
                      </p>
                    </div>
                    <StatusBadge status={v.worstStatus} className="shrink-0" />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full transition-[width] duration-500', readinessTone(pct))}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-xs font-medium tabular">{pct}%</span>
                    <span className={cn(
                      'shrink-0 text-xs font-medium tabular',
                      v.avgSlipDays > 0 && 'text-late-fg',
                    )}>
                      {v.avgSlipDays > 0 ? `+${v.avgSlipDays}d` : 'On time'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table className="[&_th]:h-9">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-44">Vendor</TableHead>
                  <TableHead className="w-16">Items</TableHead>
                  <TableHead className="w-32">Readiness</TableHead>
                  <TableHead className="w-28">Avg. Slip</TableHead>
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
                              className={cn('h-full rounded-full transition-[width] duration-500', readinessTone(pct))}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium tabular">{pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className={cn('text-xs font-medium tabular', v.avgSlipDays > 0 && 'text-late-fg')}>
                        {v.avgSlipDays > 0 ? `+${v.avgSlipDays} days` : 'On time'}
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
