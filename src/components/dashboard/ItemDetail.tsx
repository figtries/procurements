'use client';

import { ArrowLeft, Clock, Package, Pencil, Trash2, TriangleAlert } from 'lucide-react';
import type { ProcurementItem } from '@/types';
import { fmtDate } from '@/lib/procurement';
import StatusBadge from './Badge';
import DisciplineBadge from './DisciplineBadge';
import MilestoneRow from './MilestoneRow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ItemDetailProps {
  item: ProcurementItem;
  onBack: () => void;
  onEdit: (item: ProcurementItem) => void;
  onDelete: (item: ProcurementItem) => void;
}

/** Vendors send several delivery orders per item, separated any which way. */
function splitDoNumbers(raw: string): string[] {
  return raw.split(/[\n;]+|\s{2,}|&/).map(s => s.trim()).filter(Boolean);
}

/**
 * Document readiness banded like a schedule state. Written out in full —
 * Tailwind only emits the classes it can see in the source.
 */
const READINESS_TONES = {
  low:  { value: 'text-late-fg',    rail: 'bg-late' },
  mid:  { value: 'text-atrisk-fg',  rail: 'bg-atrisk' },
  full: { value: 'text-ok-fg',      rail: 'bg-ok' },
} as const;

/** A headline figure over its own rail — used for progress and readiness. */
function Meter({
  label, caption, pct, valueClassName, railClassName,
}: {
  label: string;
  caption: string;
  pct: number;
  valueClassName?: string;
  railClassName?: string;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="truncate text-xs text-muted-foreground">{caption}</p>
        </div>
        <span className={cn('text-2xl font-semibold tracking-tight tabular', valueClassName)}>
          {pct}%
        </span>
      </div>
      <Progress
        value={pct}
        trackClassName="h-2"
        indicatorClassName={cn('transition-[width] duration-700', railClassName)}
      />
    </div>
  );
}

export default function ItemDetail({ item, onBack, onEdit, onDelete }: ItemDetailProps) {
  const isLate   = item.status === 'late';
  const isAtRisk = item.status === 'atrisk';

  const readinessPct = Math.round((item.readinessDoc || 0) * 100);
  const readinessTone = READINESS_TONES[
    readinessPct < 50 ? 'low' : readinessPct < 90 ? 'mid' : 'full'
  ];
  /** Goods arrived but the delivery order was never recorded. */
  const needsDo = !!item.mos.actual && !item.doNo.trim();
  const doNumbers = splitDoNumbers(item.doNo);

  /** Eight fields fill the hairline grid exactly at two and at four columns —
   *  a short last row would leave a bare slab of divider showing. */
  const fields = [
    { label: 'Supplier / Vendor', value: item.vendor },
    { label: 'Brand', value: item.brand },
    { label: 'Qty / Unit', value: `${item.qty} ${item.unit}`.trim() },
    { label: 'Delivery Term', value: item.delivery },
    { label: 'PO Number', value: item.poNo },
    { label: 'PO Date', value: item.poDate ? fmtDate(item.poDate) : '' },
    { label: 'No. DO', value: item.doNo },
    { label: 'Material On Site', value: item.mos.actual ? fmtDate(item.mos.actual) : '' },
  ];

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-muted-foreground">
        <ArrowLeft />
        Back to Overview
      </Button>

      {(isLate || isAtRisk) && (
        <Alert className={cn(
          'motion-safe:animate-in motion-safe:fade-in',
          isLate
            ? 'border-late/25 bg-late-bg text-late-fg'
            : 'border-atrisk/30 bg-atrisk-bg text-atrisk-fg',
        )}>
          {isLate ? <TriangleAlert /> : <Clock />}
          <AlertTitle>{isLate ? 'Item is overdue.' : 'At risk.'}</AlertTitle>
          <AlertDescription className={isLate ? 'text-late-fg/80' : 'text-atrisk-fg/80'}>
            {isLate
              ? 'A milestone deadline has passed with no actual date recorded.'
              : 'FAT falls due within 14 days. Confirm readiness with the vendor.'}
          </AlertDescription>
        </Alert>
      )}

      {/* ── Identity, progress and specification ── */}
      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="min-w-0 space-y-2.5">
            {/* Discipline leads, status follows — what the item *is* before how
                it is doing. The title carries the description on its own. */}
            <div className="flex flex-wrap items-center gap-2">
              <DisciplineBadge discipline={item.discipline} />
              <StatusBadge status={item.status} />
            </div>
            <h1 className="font-heading text-xl leading-tight font-semibold tracking-tight text-balance sm:text-2xl">
              {item.desc}
            </h1>
            <p className="text-sm text-muted-foreground">
              {item.vendor || 'Vendor not set'} · PO {item.poNo || '—'}
            </p>
          </div>

          {/* Side by side and full width on a phone, so neither action ends up
              as a lone stub on its own line. */}
          <ButtonGroup className="w-full shrink-0 sm:w-auto">
            <Button
              variant="outline" size="lg"
              className="flex-1 sm:flex-none"
              onClick={() => onEdit(item)}
            >
              <Pencil />
              Edit
            </Button>
            <Button
              variant="outline" size="lg"
              className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive sm:flex-none"
              onClick={() => onDelete(item)}
            >
              <Trash2 />
              Delete
            </Button>
          </ButtonGroup>
        </div>

        <div className="grid gap-5 border-t p-4 sm:grid-cols-2 sm:gap-6 sm:p-5">
          <Meter
            label="Overall Progress"
            caption="Based on completed milestones"
            pct={item.progress}
          />
          <Meter
            label="Document Readiness"
            caption="Vendor document completeness"
            pct={readinessPct}
            valueClassName={readinessTone.value}
            railClassName={readinessTone.rail}
          />
        </div>

        {/* A hairline grid keeps eight fields legible without eight boxes. */}
        <dl className="grid grid-cols-2 gap-px border-t bg-border md:grid-cols-4">
          {fields.map(f => (
            <div key={f.label} className="min-w-0 bg-card px-4 py-3 sm:px-5">
              <dt className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {f.label}
              </dt>
              {/* DO numbers and contract references run long and have no spaces
                  to break on — let them wrap mid-token. */}
              <dd className={cn(
                'mt-1 text-sm font-medium break-words',
                !f.value && 'text-muted-foreground',
              )}>
                {f.value || '—'}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* ── Schedule beside the paperwork ── */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Milestone Schedule</CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <MilestoneRow name="FAT — Factory Acceptance Test" ms={item.fat} index={0} />
            <MilestoneRow name="RTS — Ready To Ship" ms={item.rts} index={1} />
            <MilestoneRow name="MOS — Material On Site" ms={item.mos} index={2} last />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Order</CardTitle>
            </CardHeader>
            <CardContent>
              {doNumbers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {doNumbers.map((no, i) => (
                    <Badge
                      key={`${no}-${i}`}
                      variant="secondary"
                      className="h-auto gap-1.5 rounded-lg bg-ok-bg px-2.5 py-1.5 text-sm font-semibold text-ok-fg tabular"
                    >
                      <Package />
                      {no}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className={cn(
                  'rounded-lg px-3.5 py-3 text-sm',
                  needsDo
                    ? 'bg-atrisk-bg text-atrisk-fg'
                    : 'bg-muted/60 text-muted-foreground',
                )}>
                  {needsDo
                    ? 'Material is recorded on site but no DO number was entered. Add it via Edit.'
                    : 'No DO number yet. It appears once the vendor sends the delivery note.'}
                </p>
              )}
            </CardContent>
          </Card>

          {item.termOfPayment && (
            <Card>
              <CardHeader>
                <CardTitle>Term of Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  {item.termOfPayment}
                </p>
              </CardContent>
            </Card>
          )}

          {item.statusNote && (
            <Card>
              <CardHeader>
                <CardTitle>Status Note</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  {item.statusNote}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
