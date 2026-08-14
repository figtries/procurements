'use client';

import { useState } from 'react';
import type { ProcurementItem } from '@/types';
import { DISCIPLINES } from '@/lib/utils';

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
    fatPlan: item.fat.plan,  fatFc: item.fat.forecast,  fatAct: item.fat.actual,  fatNote: item.fat.note,
    rtsPlan: item.rts.plan,  rtsFc: item.rts.forecast,  rtsAct: item.rts.actual,  rtsNote: item.rts.note,
    mosPlan: item.mos.plan,  mosFc: item.mos.forecast,  mosAct: item.mos.actual,  mosNote: item.mos.note,
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
  { label: 'FAT — Factory Acceptance Test', plan: 'fatPlan', fc: 'fatFc', act: 'fatAct', note: 'fatNote', placeholder: 'FAT note (optional)' },
  { label: 'RTS — Ready To Ship',           plan: 'rtsPlan', fc: 'rtsFc', act: 'rtsAct', note: 'rtsNote', placeholder: 'RTS note (optional)' },
  { label: 'MOS — Material On Site',        plan: 'mosPlan', fc: 'mosFc', act: 'mosAct', note: 'mosNote', placeholder: 'MOS note (optional)' },
] as const;

export default function ItemFormModal({
  open, editingItem, onClose, onSave,
}: ItemFormModalProps) {
  const [form, setForm] = useState<ItemFormState>(() => editingItem ? itemToForm(editingItem) : emptyFormState());
  const [errors, setErrors] = useState<Partial<Record<keyof ItemFormState, string>>>({});

  // Keep track of previous props to safely update state during render phase
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
    if (!form.desc.trim())   errs.desc       = 'Description is required';
    if (!form.discipline)    errs.discipline  = 'Select a discipline';
    if (!form.vendor.trim()) errs.vendor      = 'Vendor is required';
    if (!form.poNo.trim())   errs.poNo        = 'PO number is required';
    if (!form.poDate)        errs.poDate      = 'PO date is required';
    if (!form.qty || Number(form.qty) <= 0) errs.qty = 'Enter a valid quantity';
    const readiness = Number(form.readinessDoc);
    if (form.readinessDoc !== '' && (isNaN(readiness) || readiness < 0 || readiness > 100)) {
      errs.readinessDoc = 'Isi antara 0 dan 100';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => { if (validate()) onSave(form); };

  return (
    <div
      className={`modal-bg${open ? ' open' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <div className="modal-head">
          <div className="modal-title">
            {editingItem ? 'Edit Procurement Item' : 'Add Procurement Item'}
          </div>
        </div>

        <div className="modal-body">
          {/* ── Equipment ── */}
          <div className="form-section-label">Equipment</div>

          <div className="field">
            <label className="flabel">Description <span className="req">*</span></label>
            <input
              className={`finput${errors.desc ? ' field-error' : ''}`}
              value={form.desc}
              onChange={set('desc')}
              placeholder="e.g. Microturbine Generator Package"
            />
            {errors.desc && <div className="field-error-msg">{errors.desc}</div>}
          </div>

          <div className="field">
            <label className="flabel">Discipline <span className="req">*</span></label>
            <div className="choice-pills">
              {DISCIPLINES.map(d => (
                <button
                  key={d}
                  className={`cpill${form.discipline === d ? ' active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, discipline: d }))}
                >
                  {d}
                </button>
              ))}
            </div>
            {errors.discipline && <div className="field-error-msg">{errors.discipline}</div>}
          </div>

          <div className="field">
            <label className="flabel">Quantity &amp; Unit <span className="req">*</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input
                className={`finput${errors.qty ? ' field-error' : ''}`}
                type="number"
                value={form.qty}
                onChange={set('qty')}
                placeholder="1"
                min={0}
              />
              <input className="finput" value={form.unit} onChange={set('unit')} placeholder="Ea / Lot / Set" />
            </div>
            {errors.qty && <div className="field-error-msg">{errors.qty}</div>}
          </div>

          {/* ── Vendor ── */}
          <div className="form-section-label">Vendor</div>

          <div className="field">
            <div className="field-row">
              <div>
                <label className="flabel">Supplier / vendor <span className="req">*</span></label>
                <input
                  className={`finput${errors.vendor ? ' field-error' : ''}`}
                  value={form.vendor}
                  onChange={set('vendor')}
                  placeholder="e.g. PT. Fajar Mas Murni"
                />
                {errors.vendor && <div className="field-error-msg">{errors.vendor}</div>}
              </div>
              <div>
                <label className="flabel">Brand <span className="opt">(optional)</span></label>
                <input className="finput" value={form.brand} onChange={set('brand')} placeholder="e.g. Flex Turbines" />
              </div>
            </div>
          </div>

          <div className="field">
            <label className="flabel">Delivery term <span className="opt">(optional)</span></label>
            <input className="finput" value={form.delivery} onChange={set('delivery')} placeholder="e.g. DDP SKN" />
          </div>

          {/* ── PO & Status ── */}
          <div className="form-section-label">PO &amp; Status</div>

          <div className="field">
            <div className="field-row">
              <div>
                <label className="flabel">PO no. <span className="req">*</span></label>
                <input
                  className={`finput${errors.poNo ? ' field-error' : ''}`}
                  value={form.poNo}
                  onChange={set('poNo')}
                  placeholder="e.g. PO-2401888"
                />
                {errors.poNo && <div className="field-error-msg">{errors.poNo}</div>}
              </div>
              <div>
                <label className="flabel">PO date <span className="req">*</span></label>
                <input
                  className={`finput${errors.poDate ? ' field-error' : ''}`}
                  type="date"
                  value={form.poDate}
                  onChange={set('poDate')}
                />
                {errors.poDate && <div className="field-error-msg">{errors.poDate}</div>}
              </div>
            </div>
          </div>

          <div className="field">
            <div className="field-row">
              <div>
                <label className="flabel">
                  Document readiness <span className="opt">(0–100%)</span>
                </label>
                <input
                  className={`finput${errors.readinessDoc ? ' field-error' : ''}`}
                  type="number"
                  min={0}
                  max={100}
                  value={form.readinessDoc}
                  onChange={set('readinessDoc')}
                  placeholder="0"
                />
                {errors.readinessDoc && <div className="field-error-msg">{errors.readinessDoc}</div>}
              </div>
              <div>
                <label className="flabel">No. DO <span className="opt">(optional)</span></label>
                <input
                  className="finput"
                  value={form.doNo}
                  onChange={set('doNo')}
                  placeholder="e.g. 007/SP/DO/CPPG/V/26"
                />
              </div>
            </div>
          </div>

          <div className="field">
            <label className="flabel">Term of payment <span className="opt">(optional)</span></label>
            <textarea
              className="finput"
              value={form.termOfPayment}
              onChange={set('termOfPayment')}
              placeholder="e.g. 30% down payment · 70% after delivery"
            />
          </div>

          <div className="field">
            <label className="flabel">Status note <span className="opt">(optional)</span></label>
            <textarea
              className="finput"
              value={form.statusNote}
              onChange={set('statusNote')}
              placeholder="e.g. On progress fabrication"
            />
          </div>

          {/* ── Milestones ── */}
          <div className="form-section-label">
            Milestone Schedule{' '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-tertiary)' }}>
              — fill what you have
            </span>
          </div>

          {MILESTONES.map(ms => (
            <div className="field" key={ms.label}>
              <div className="mini-label">{ms.label}</div>
              <div className="field-row-3">
                <input type="date" className="finput" value={form[ms.plan]} onChange={set(ms.plan)} />
                <input type="date" className="finput" value={form[ms.fc]}   onChange={set(ms.fc)} />
                <input type="date" className="finput" value={form[ms.act]}  onChange={set(ms.act)} />
              </div>
              <div className="field-row-3" style={{ marginTop: 4 }}>
                <span className="mini-label" style={{ margin: 0 }}>Plan</span>
                <span className="mini-label" style={{ margin: 0 }}>Forecast</span>
                <span className="mini-label" style={{ margin: 0 }}>Actual</span>
              </div>
              <input
                type="text"
                className="finput"
                style={{ marginTop: 8, fontSize: 13 }}
                value={form[ms.note]}
                onChange={set(ms.note)}
                placeholder={ms.placeholder}
              />
            </div>
          ))}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
