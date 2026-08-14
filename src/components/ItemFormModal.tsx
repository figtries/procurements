'use client';

import { useState } from 'react';
import type { ProcurementItem } from '@/types';
import { DISCIPLINES } from '@/lib/procurement';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

/* ── Types ── */
export interface ItemFormState {
  desc: string;
  discipline: string;
  qty: string;
  unit: string;
  vendor: string;
  brand: string;
  delivery: string;
  poNo: string;
  poDate: string;
  statusNote: string;
  /** Held as a percentage string (0–100) so the number input behaves predictably. */
  readinessDoc: string;
  doNo: string;
  termOfPayment: string;
  fatPlan: string; fatFc: string; fatAct: string; fatNote: string;
  rtsPlan: string; rtsFc: string; rtsAct: string; rtsNote: string;
  mosPlan: string; mosFc: string; mosAct: string; mosNote: string;
}

export function emptyFormState(): ItemFormState {
  return {
    desc: '', discipline: '', qty: '1', unit: '',
    vendor: '', brand: '', delivery: '',
    poNo: '', poDate: '', statusNote: '',
    readinessDoc: '0', doNo: '', termOfPayment: '',
    fatPlan: '', fatFc: '', fatAct: '', fatNote: '',
    rtsPlan: '', rtsFc: '', rtsAct: '', rtsNote: '',
    mosPlan: '', mosFc: '', mosAct: '', mosNote: '',
  };
}

export function itemToForm(item: ProcurementItem): ItemFormState {
  return {
    desc: item.desc, discipline: item.discipline,
    qty: String(item.qty), unit: item.unit,
    vendor: item.vendor, brand: item.brand, delivery: item.delivery,
    poNo: item.poNo, poDate: item.poDate, statusNote: item.statusNote,
    readinessDoc: String(Math.round((item.readinessDoc || 0) * 100)),
    doNo: item.doNo, termOfPayment: item.termOfPayment,
    fatPlan: item.fat.plan, fatFc: item.fat.forecast, fatAct: item.fat.actual, fatNote: item.fat.note,
    rtsPlan: item.rts.plan, rtsFc: item.rts.forecast, rtsAct: item.rts.actual, rtsNote: item.rts.note,
    mosPlan: item.mos.plan, mosFc: item.mos.forecast, mosAct: item.mos.actual, mosNote: item.mos.note,
  };
}

/* ── Component ── */
interface ItemFormModalProps {
  open: boolean;
  editingItem: ProcurementItem | null;
  onClose: () => void;
  onSave: (form: ItemFormState) => void;
}

const MILESTONES = [
  { label: 'FAT — Factory Acceptance Test', plan: 'fatPlan', fc: 'fatFc', act: 'fatAct', note: 'fatNote', placeholder: 'Catatan FAT (opsional)' },
  { label: 'RTS — Ready To Ship',           plan: 'rtsPlan', fc: 'rtsFc', act: 'rtsAct', note: 'rtsNote', placeholder: 'Catatan RTS (opsional)' },
  { label: 'MOS — Material On Site',        plan: 'mosPlan', fc: 'mosFc', act: 'mosAct', note: 'mosNote', placeholder: 'Catatan MOS (opsional)' },
] as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

export default function ItemFormModal({
  open, editingItem, onClose, onSave,
}: ItemFormModalProps) {
  const [form, setForm] = useState<ItemFormState>(
    () => (editingItem ? itemToForm(editingItem) : emptyFormState()),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof ItemFormState, string>>>({});

  // Keep track of previous props to safely reset state during the render phase.
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevEditingItem, setPrevEditingItem] = useState(editingItem);

  if (open !== prevOpen || editingItem !== prevEditingItem) {
    setPrevOpen(open);
    setPrevEditingItem(editingItem);
    if (open) {
      setForm(editingItem ? itemToForm(editingItem) : emptyFormState());
      setErrors({});
    }
  }

  const set = (key: keyof ItemFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.desc.trim())   errs.desc       = 'Deskripsi wajib diisi';
    if (!form.discipline)    errs.discipline = 'Pilih disiplin';
    if (!form.vendor.trim()) errs.vendor     = 'Vendor wajib diisi';
    if (!form.poNo.trim())   errs.poNo       = 'Nomor PO wajib diisi';
    if (!form.poDate)        errs.poDate     = 'Tanggal PO wajib diisi';
    if (!form.qty || Number(form.qty) <= 0) errs.qty = 'Isi jumlah yang valid';
    const readiness = Number(form.readinessDoc);
    if (form.readinessDoc !== '' && (isNaN(readiness) || readiness < 0 || readiness > 100)) {
      errs.readinessDoc = 'Isi antara 0 dan 100';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => { if (validate()) onSave(form); };

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90svh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-4">
          <DialogTitle>
            {editingItem ? 'Edit Procurement Item' : 'Tambah Procurement Item'}
          </DialogTitle>
          <DialogDescription>
            Isi yang sudah diketahui — sisanya bisa dilengkapi belakangan.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(90svh-11rem)] space-y-5 overflow-y-auto p-4">
          {/* ── Equipment ── */}
          <SectionLabel>Equipment</SectionLabel>

          <div className="grid gap-2">
            <Label htmlFor="if-desc">Deskripsi <span className="text-destructive">*</span></Label>
            <Input
              id="if-desc" value={form.desc} onChange={set('desc')}
              aria-invalid={!!errors.desc}
              placeholder="mis. Microturbine Generator Package"
            />
            {errors.desc && <p className="text-xs text-destructive">{errors.desc}</p>}
          </div>

          <div className="grid gap-2">
            <Label>Disiplin <span className="text-destructive">*</span></Label>
            <div className="flex flex-wrap gap-2">
              {DISCIPLINES.map(d => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant={form.discipline === d ? 'default' : 'outline'}
                  onClick={() => setForm(f => ({ ...f, discipline: d }))}
                >
                  {d}
                </Button>
              ))}
            </div>
            {errors.discipline && <p className="text-xs text-destructive">{errors.discipline}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="if-qty">Jumlah <span className="text-destructive">*</span></Label>
              <Input
                id="if-qty" type="number" min={0} value={form.qty} onChange={set('qty')}
                aria-invalid={!!errors.qty} placeholder="1"
              />
              {errors.qty && <p className="text-xs text-destructive">{errors.qty}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="if-unit">Satuan</Label>
              <Input id="if-unit" value={form.unit} onChange={set('unit')} placeholder="Ea / Lot / Set" />
            </div>
          </div>

          <Separator />

          {/* ── Vendor ── */}
          <SectionLabel>Vendor</SectionLabel>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="if-vendor">Supplier / vendor <span className="text-destructive">*</span></Label>
              <Input
                id="if-vendor" value={form.vendor} onChange={set('vendor')}
                aria-invalid={!!errors.vendor} placeholder="mis. PT. Fajar Mas Murni"
              />
              {errors.vendor && <p className="text-xs text-destructive">{errors.vendor}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="if-brand">Brand</Label>
              <Input id="if-brand" value={form.brand} onChange={set('brand')} placeholder="mis. Flex Turbines" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="if-delivery">Delivery term</Label>
            <Input id="if-delivery" value={form.delivery} onChange={set('delivery')} placeholder="mis. DDP SKN" />
          </div>

          <Separator />

          {/* ── PO & dokumen ── */}
          <SectionLabel>PO &amp; Dokumen</SectionLabel>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="if-pono">No. PO <span className="text-destructive">*</span></Label>
              <Input
                id="if-pono" value={form.poNo} onChange={set('poNo')}
                aria-invalid={!!errors.poNo} placeholder="mis. PO-2501855"
              />
              {errors.poNo && <p className="text-xs text-destructive">{errors.poNo}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="if-podate">Tanggal PO <span className="text-destructive">*</span></Label>
              <Input
                id="if-podate" type="date" value={form.poDate} onChange={set('poDate')}
                aria-invalid={!!errors.poDate}
              />
              {errors.poDate && <p className="text-xs text-destructive">{errors.poDate}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="if-readiness">
                Document readiness <span className="font-normal text-muted-foreground">(0–100%)</span>
              </Label>
              <Input
                id="if-readiness" type="number" min={0} max={100}
                value={form.readinessDoc} onChange={set('readinessDoc')}
                aria-invalid={!!errors.readinessDoc} placeholder="0"
              />
              {errors.readinessDoc && <p className="text-xs text-destructive">{errors.readinessDoc}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="if-dono">No. DO</Label>
              <Input
                id="if-dono" value={form.doNo} onChange={set('doNo')}
                placeholder="mis. 007/SP/DO/CPPG/V/26"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="if-top">Term of payment</Label>
            <Textarea
              id="if-top" value={form.termOfPayment} onChange={set('termOfPayment')}
              placeholder="mis. 30% down payment · 70% after delivery"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="if-note">Status note</Label>
            <Textarea
              id="if-note" value={form.statusNote} onChange={set('statusNote')}
              placeholder="mis. On progress fabrication"
            />
          </div>

          <Separator />

          {/* ── Milestones ── */}
          <SectionLabel>Milestone Schedule</SectionLabel>

          {MILESTONES.map(ms => (
            <div key={ms.label} className="rounded-xl border p-3">
              <p className="mb-3 text-sm font-medium">{ms.label}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {([
                  ['Plan', ms.plan],
                  ['Forecast', ms.fc],
                  ['Actual', ms.act],
                ] as const).map(([label, key]) => (
                  <div key={key} className="grid gap-1.5">
                    <Label
                      htmlFor={`if-${key}`}
                      className="text-[10px] uppercase tracking-wider text-muted-foreground"
                    >
                      {label}
                    </Label>
                    <Input id={`if-${key}`} type="date" value={form[key]} onChange={set(key)} />
                  </div>
                ))}
              </div>
              <Input
                className="mt-3 text-[13px]"
                value={form[ms.note]} onChange={set(ms.note)}
                placeholder={ms.placeholder}
              />
            </div>
          ))}
        </div>

        <DialogFooter className="m-0 rounded-none">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave}>Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
