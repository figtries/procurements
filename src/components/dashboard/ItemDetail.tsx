'use client';

import { ArrowLeft, Clock, Package, Pencil, Trash2, TriangleAlert } from 'lucide-react';
import type { ProcurementItem } from '@/types';
import { fmtDate, getDisciplineStyle } from '@/lib/procurement';
import StatusBadge from './Badge';
import MilestoneRow from './MilestoneRow';
import ProgBar from './ProgBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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

export default function ItemDetail({ item, onBack, onEdit, onDelete }: ItemDetailProps) {
  const discStyle = getDisciplineStyle(item.discipline);
  const isLate   = item.status === 'late';
  const isAtRisk = item.status === 'atrisk';

  const readinessPct = Math.round((item.readinessDoc || 0) * 100);
  const readinessTone =
    readinessPct < 50 ? 'bg-late' : readinessPct < 90 ? 'bg-atrisk' : 'bg-ontrack';
  /** Goods arrived but the delivery order was never recorded. */
  const needsDo = !!item.mos.actual && !item.doNo.trim();
  const doNumbers = splitDoNumbers(item.doNo);

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
    <div className="animate-page-in">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 mb-3 text-muted-foreground">
        <ArrowLeft className="size-4" />
        Kembali ke Overview
      </Button>

      {(isLate || isAtRisk) && (
        <div className={cn(
          'mb-4 flex items-start gap-3 rounded-xl border px-4 py-3.5',
          isLate ? 'border-late/20 bg-late-bg' : 'border-atrisk/25 bg-atrisk-bg',
        )}>
          {isLate
            ? <TriangleAlert className="size-5 shrink-0 text-late-fg" />
            : <Clock className="size-5 shrink-0 text-atrisk-fg" />}
          <p className={cn('text-sm', isLate ? 'text-late-fg' : 'text-atrisk-fg')}>
            {isLate ? (
              <><span className="font-semibold">Item lewat tempo.</span>{' '}
                Ada milestone yang tenggatnya sudah lewat tanpa tanggal aktual.</>
            ) : (
              <><span className="font-semibold">At risk.</span>{' '}
                FAT jatuh tempo dalam 14 hari. Konfirmasi kesiapan ke vendor.</>
            )}
          </p>
        </div>
      )}

      {/* Hero */}
      <Card className="mb-4">
        <CardContent>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <StatusBadge status={item.status} />
              <h1 className="mt-2.5 text-2xl font-semibold leading-tight tracking-tight">
                <span
                  className="mr-2 inline-block rounded px-2 py-0.5 align-middle text-[11px] font-bold"
                  style={{ background: discStyle.bg, color: discStyle.color }}
                >
                  {item.discipline}
                </span>
                {item.desc}
              </h1>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => onEdit(item)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={() => onDelete(item)}>
                <Trash2 className="size-3.5" />
                Hapus
              </Button>
            </div>
          </div>

          <Separator className="my-5" />

          {/* Progress + readiness */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Overall Progress</p>
                  <p className="text-xs text-muted-foreground">Berdasarkan milestone yang selesai</p>
                </div>
                <span className="text-2xl font-semibold tracking-tight tabular">{item.progress}%</span>
              </div>
              <ProgBar value={item.progress} className="h-2.5" />
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Document Readiness</p>
                  <p className="text-xs text-muted-foreground">Kelengkapan dokumen vendor</p>
                </div>
                <span className={cn(
                  'text-2xl font-semibold tracking-tight tabular',
                  readinessPct < 50 ? 'text-late-fg' : readinessPct < 90 ? 'text-atrisk-fg' : 'text-ontrack-fg',
                )}>
                  {readinessPct}%
                </span>
              </div>
              <ProgBar value={readinessPct} className="h-2.5" indicatorClassName={readinessTone} />
            </div>
          </div>

          <Separator className="my-5" />

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            {fields.map(f => (
              <div key={f.label}>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </dt>
                <dd className={cn('mt-1 text-sm font-medium', !f.value && 'text-muted-foreground')}>
                  {f.value || '—'}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Delivery Order */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Delivery Order</CardTitle>
          <CardDescription>Bukti pengiriman dari vendor</CardDescription>
        </CardHeader>
        <CardContent>
          {doNumbers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {doNumbers.map((no, i) => (
                <span
                  key={`${no}-${i}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-ontrack/25 bg-ontrack-bg px-3 py-2"
                >
                  <Package className="size-3.5 text-ontrack-fg" />
                  <span className="text-sm font-semibold text-ontrack-fg tabular">{no}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className={cn(
              'rounded-lg border-l-[3px] px-4 py-3 text-sm',
              needsDo
                ? 'border-l-atrisk bg-atrisk-bg text-atrisk-fg'
                : 'border-l-border bg-muted/50 text-muted-foreground',
            )}>
              {needsDo
                ? 'Material tercatat sudah on site, tapi nomor DO belum diisi. Lengkapi lewat tombol Edit.'
                : 'Belum ada nomor DO. Akan terisi setelah vendor mengirim surat jalan.'}
            </p>
          )}

          {item.termOfPayment && (
            <>
              <Separator className="my-5" />
              <p className="text-sm font-medium">Term of Payment</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {item.termOfPayment}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {item.statusNote && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Status Note</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {item.statusNote}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Milestone Schedule</CardTitle>
          <CardDescription>FAT → RTS → MOS</CardDescription>
        </CardHeader>
        <CardContent className="pt-1">
          <MilestoneRow name="FAT — Factory Acceptance Test" ms={item.fat} index={0} />
          <MilestoneRow name="RTS — Ready To Ship" ms={item.rts} index={1} />
          <MilestoneRow name="MOS — Material On Site" ms={item.mos} index={2} last />
        </CardContent>
      </Card>
    </div>
  );
}
