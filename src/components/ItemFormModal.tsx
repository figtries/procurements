'use client';

import { useState } from 'react';
import type { ProcurementItem } from '@/types';
import { DISCIPLINES, getDisciplineStyle } from '@/lib/procurement';
import { blockers, validateItem } from '@/lib/rules';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/* ── Types ── */
export interface ItemFormState {
  desc: string;
  discipline: string;
  qty: string;
  unit: string;
  vendor: string;
  vendorPic: string;
  vendorPhone: string;
  brand: string;
  delivery: string;
  poNo: string;
  poDate: string;
  statusNote: string;
  /** Held as a percentage string (0–100) so the number input behaves predictably. */
  readinessDoc: string;
  doNo: string;
  termOfPayment: string;
  /** Manufacturing, held as percentage strings (0–100) like readiness. */
  mfgPlan: string;
  mfgActual: string;
  mfgNote: string;
  fatPlan: string; fatFc: string; fatAct: string; fatNote: string;
  rtsPlan: string; rtsFc: string; rtsAct: string; rtsNote: string;
  mosPlan: string; mosFc: string; mosAct: string; mosNote: string;
}

export function emptyFormState(): ItemFormState {
  return {
    desc: '', discipline: '', qty: '1', unit: '',
    vendor: '', vendorPic: '', vendorPhone: '', brand: '', delivery: '',
    poNo: '', poDate: '', statusNote: '',
    readinessDoc: '0', doNo: '', termOfPayment: '',
    mfgPlan: '0', mfgActual: '0', mfgNote: '',
    fatPlan: '', fatFc: '', fatAct: '', fatNote: '',
    rtsPlan: '', rtsFc: '', rtsAct: '', rtsNote: '',
    mosPlan: '', mosFc: '', mosAct: '', mosNote: '',
  };
}

/** Which input a rule violation belongs under. */
const RULE_FIELDS: Partial<Record<string, keyof ItemFormState>> = {
  qty: 'qty',
  doNo: 'doNo',
  readinessDoc: 'readinessDoc',
  'mfg.plan': 'mfgPlan',
  'mfg.actual': 'mfgActual',
  'fat.plan': 'fatPlan', 'fat.forecast': 'fatFc', 'fat.actual': 'fatAct',
  'rts.plan': 'rtsPlan', 'rts.forecast': 'rtsFc', 'rts.actual': 'rtsAct',
  'mos.plan': 'mosPlan', 'mos.forecast': 'mosFc', 'mos.actual': 'mosAct',
};

/** The shape the rule set checks, built from what is currently typed in. */
function formToChecked(form: ItemFormState) {
  const ms = (plan: string, forecast: string, actual: string) => ({
    plan, forecast, actual, note: '',
  });
  return {
    qty: Number(form.qty),
    poDate: form.poDate,
    readinessDoc: (Number(form.readinessDoc) || 0) / 100,
    doNo: form.doNo,
    mfg: {
      plan: (Number(form.mfgPlan) || 0) / 100,
      actual: (Number(form.mfgActual) || 0) / 100,
      note: '',
    },
    fat: ms(form.fatPlan, form.fatFc, form.fatAct),
    rts: ms(form.rtsPlan, form.rtsFc, form.rtsAct),
    mos: ms(form.mosPlan, form.mosFc, form.mosAct),
  };
}

export function itemToForm(item: ProcurementItem): ItemFormState {
  return {
    desc: item.desc, discipline: item.discipline,
    qty: String(item.qty), unit: item.unit,
    vendor: item.vendor, vendorPic: item.vendorPic, vendorPhone: item.vendorPhone,
    brand: item.brand, delivery: item.delivery,
    poNo: item.poNo, poDate: item.poDate, statusNote: item.statusNote,
    readinessDoc: String(Math.round((item.readinessDoc || 0) * 100)),
    doNo: item.doNo, termOfPayment: item.termOfPayment,
    mfgPlan: String(Math.round((item.mfg?.plan || 0) * 100)),
    mfgActual: String(Math.round((item.mfg?.actual || 0) * 100)),
    mfgNote: item.mfg?.note ?? '',
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

/** Base UI wants the option list up front so it can size the popup and read
 *  back a label for the trigger. */
const DISCIPLINE_OPTIONS = DISCIPLINES.map(d => ({ value: d, label: d }));

const MILESTONES = [
  { label: 'FAT — Factory Acceptance Test', plan: 'fatPlan', fc: 'fatFc', act: 'fatAct', note: 'fatNote', placeholder: 'FAT note (optional)' },
  { label: 'RTS — Ready To Ship',           plan: 'rtsPlan', fc: 'rtsFc', act: 'rtsAct', note: 'rtsNote', placeholder: 'RTS note (optional)' },
  { label: 'MOS — Material On Site',        plan: 'mosPlan', fc: 'mosFc', act: 'mosAct', note: 'mosNote', placeholder: 'MOS note (optional)' },
] as const;

/** Sections are told apart by breathing room and a quiet heading, not by rules
 *  drawn across the form. `first:mt-0` keeps the top of the body tight. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-8 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground first:mt-0">
      {children}
    </p>
  );
}

/** The dot an option wears on the board, so the picker previews the row. */
function DisciplineDot({ name }: { name: string }) {
  return (
    <span
      className="size-1.5 shrink-0 rounded-full"
      style={{ background: getDisciplineStyle(name).color }}
    />
  );
}

export default function ItemFormModal({
  open, editingItem, onClose, onSave,
}: ItemFormModalProps) {
  const [form, setForm] = useState<ItemFormState>(
    () => (editingItem ? itemToForm(editingItem) : emptyFormState()),
  );
  /** Required fields that were empty on the last save attempt. */
  const [missing, setMissing] = useState<Partial<Record<keyof ItemFormState, string>>>({});

  // Keep track of previous props to safely reset state during the render phase.
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevEditingItem, setPrevEditingItem] = useState(editingItem);

  if (open !== prevOpen || editingItem !== prevEditingItem) {
    setPrevOpen(open);
    setPrevEditingItem(editingItem);
    if (open) {
      setForm(editingItem ? itemToForm(editingItem) : emptyFormState());
      setMissing({});
    }
  }

  const set = (key: keyof ItemFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));

  /**
   * The procedural rules — order of stages, dates that run forward — come from
   * the shared rule set, so this form and a returned vendor form judge a record
   * by exactly the same standard.
   *
   * Checked on every render rather than on save, so putting delivery before RTS
   * is refused while it is being typed. Missing required fields stay on save:
   * telling someone their description is empty before they have reached it is
   * nagging, not discipline.
   */
  const ruleErrors: Partial<Record<keyof ItemFormState, string>> = {};
  for (const violation of blockers(validateItem(formToChecked(form)))) {
    const key = RULE_FIELDS[violation.field];
    if (key && !ruleErrors[key]) ruleErrors[key] = violation.message;
  }

  const errors = { ...missing, ...ruleErrors };

  const validate = (): boolean => {
    const errs: typeof missing = {};
    if (!form.desc.trim())   errs.desc       = 'Description is required';
    if (!form.discipline)    errs.discipline = 'Pick a discipline';
    if (!form.vendor.trim()) errs.vendor     = 'Vendor is required';
    if (!form.poNo.trim())   errs.poNo       = 'PO number is required';
    if (!form.poDate)        errs.poDate     = 'PO date is required';
    const readiness = Number(form.readinessDoc);
    if (form.readinessDoc !== '' && (isNaN(readiness) || readiness < 0 || readiness > 100)) {
      errs.readinessDoc = 'Enter a value between 0 and 100';
    }
    setMissing(errs);
    return Object.keys(errs).length === 0 && Object.keys(ruleErrors).length === 0;
  };

  const handleSave = () => { if (validate()) onSave(form); };

  /** Everything standing between this form and a save, in one list. */
  const problems = Object.values(errors).filter(Boolean) as string[];

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
      {/* Flex column rather than the default grid, so the body takes whatever
          height is left after the header and footer instead of being told a
          magic number that only holds at one viewport size. */}
      <DialogContent
        className="flex max-h-[85svh] flex-col gap-0 overflow-hidden p-0 sm:max-h-[90svh] sm:max-w-2xl"
      >
        <DialogHeader className="shrink-0 p-4 pb-3">
          <DialogTitle>
            {editingItem ? 'Edit Procurement Item' : 'Add Procurement Item'}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-5 p-4">
          {/* ── Equipment ── */}
          <SectionLabel>Equipment</SectionLabel>

          <div className="grid gap-2">
            <Label htmlFor="if-desc">Description <span className="text-destructive">*</span></Label>
            <Input
              id="if-desc" value={form.desc} onChange={set('desc')}
              aria-invalid={!!errors.desc}
              placeholder="e.g. Microturbine Generator Package"
            />
            {errors.desc && <p className="text-xs text-destructive">{errors.desc}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="if-discipline">Discipline <span className="text-destructive">*</span></Label>
              <Select
                items={DISCIPLINE_OPTIONS}
                value={form.discipline || null}
                onValueChange={v =>
                  setForm(f => ({ ...f, discipline: (v as string | null) ?? '' }))
                }
              >
                <SelectTrigger
                  id="if-discipline"
                  className="w-full"
                  aria-invalid={!!errors.discipline}
                >
                  {form.discipline && <DisciplineDot name={form.discipline} />}
                  <SelectValue placeholder="Select discipline" />
                </SelectTrigger>
                <SelectContent>
                  {DISCIPLINES.map(d => (
                    <SelectItem key={d} value={d}>
                      <DisciplineDot name={d} />
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.discipline && <p className="text-xs text-destructive">{errors.discipline}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="if-qty">Quantity <span className="text-destructive">*</span></Label>
              <Input
                id="if-qty" type="number" min={0} value={form.qty} onChange={set('qty')}
                aria-invalid={!!errors.qty} placeholder="1"
              />
              {errors.qty && <p className="text-xs text-destructive">{errors.qty}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="if-unit">Unit</Label>
              <Input id="if-unit" value={form.unit} onChange={set('unit')} placeholder="Ea / Lot / Set" />
            </div>
          </div>

          {/* ── Vendor ── */}
          <SectionLabel>Vendor</SectionLabel>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="if-vendor">Supplier / vendor <span className="text-destructive">*</span></Label>
              <Input
                id="if-vendor" value={form.vendor} onChange={set('vendor')}
                aria-invalid={!!errors.vendor} placeholder="e.g. PT. Fajar Mas Murni"
              />
              {errors.vendor && <p className="text-xs text-destructive">{errors.vendor}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="if-brand">Brand</Label>
              <Input id="if-brand" value={form.brand} onChange={set('brand')} placeholder="e.g. Flex Turbines" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="if-pic">PIC</Label>
              <Input
                id="if-pic" value={form.vendorPic} onChange={set('vendorPic')}
                placeholder="e.g. Andi Pratama"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="if-picno">PIC number</Label>
              <Input
                id="if-picno" type="tel" inputMode="tel"
                value={form.vendorPhone} onChange={set('vendorPhone')}
                placeholder="e.g. 0812-3456-7890"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="if-delivery">Delivery term</Label>
            <Input id="if-delivery" value={form.delivery} onChange={set('delivery')} placeholder="e.g. DDP SKN" />
          </div>

          {/* ── PO & dokumen ── */}
          <SectionLabel>PO &amp; documents</SectionLabel>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="if-pono">PO no. <span className="text-destructive">*</span></Label>
              <Input
                id="if-pono" value={form.poNo} onChange={set('poNo')}
                aria-invalid={!!errors.poNo} placeholder="e.g. PO-2501855"
              />
              {errors.poNo && <p className="text-xs text-destructive">{errors.poNo}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="if-podate">PO date <span className="text-destructive">*</span></Label>
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
                placeholder="e.g. 007/SP/DO/CPPG/V/26"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="if-top">Term of payment</Label>
            <Textarea
              id="if-top" value={form.termOfPayment} onChange={set('termOfPayment')}
              placeholder="e.g. 30% down payment · 70% after delivery"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="if-note">Status note</Label>
            <Textarea
              id="if-note" value={form.statusNote} onChange={set('statusNote')}
              placeholder="e.g. On progress fabrication"
            />
          </div>

          {/* ── Manufacturing ──
              Two percentages rather than dates: it is the one stage that runs
              for months, so what matters is how far along it is. */}
          <SectionLabel>MFG — Manufacturing / Fabrication</SectionLabel>

          <div className="rounded-xl bg-muted/40 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label
                  htmlFor="if-mfgplan"
                  className="text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  Plan %
                </Label>
                <Input
                  id="if-mfgplan" type="number" min={0} max={100}
                  value={form.mfgPlan} onChange={set('mfgPlan')}
                  aria-invalid={!!errors.mfgPlan}
                />
                {errors.mfgPlan && (
                  <p className="text-xs leading-snug text-destructive">{errors.mfgPlan}</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="if-mfgactual"
                  className="text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  Actual %
                </Label>
                <Input
                  id="if-mfgactual" type="number" min={0} max={100}
                  value={form.mfgActual} onChange={set('mfgActual')}
                  aria-invalid={!!errors.mfgActual}
                />
                {errors.mfgActual && (
                  <p className="text-xs leading-snug text-destructive">{errors.mfgActual}</p>
                )}
              </div>
            </div>
            <Input
              className="mt-3 text-[13px]"
              value={form.mfgNote} onChange={set('mfgNote')}
              placeholder="Manufacturing note (optional)"
            />
          </div>

          {/* ── Milestones ── */}
          <SectionLabel>Milestone Schedule</SectionLabel>

          {MILESTONES.map(ms => (
            <div key={ms.label} className="rounded-xl bg-muted/40 p-3">
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
                    <Input
                      id={`if-${key}`} type="date" value={form[key]} onChange={set(key)}
                      aria-invalid={!!errors[key]}
                    />
                    {errors[key] && (
                      <p className="text-xs leading-snug text-destructive">{errors[key]}</p>
                    )}
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
        </DialogBody>

        {/* The dialog scrolls, so a message beside the offending input can sit
            well off screen — and a Save button that silently does nothing is
            worse than no rule at all. This strip never scrolls away. */}
        {problems.length > 0 && (
          <div className="shrink-0 border-t border-destructive/20 bg-destructive/5 px-4 py-2.5">
            <p className="text-sm font-medium text-destructive">
              {problems.length === 1
                ? 'One thing needs fixing before this can be saved:'
                : `${problems.length} things need fixing before this can be saved:`}
            </p>
            <ul className="mt-1 space-y-0.5">
              {problems.map(text => (
                <li key={text} className="text-xs leading-snug text-destructive/90">{text}</li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="m-0 shrink-0 rounded-none">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
