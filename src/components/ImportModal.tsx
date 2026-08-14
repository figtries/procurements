'use client';

import { useRef, useState } from 'react';
import type { ImportResult, ImportedRow, ProcurementItem } from '@/types';
import { importWorkbook } from '@/lib/excelImport';
import { DISCIPLINES, fmtDate } from '@/lib/utils';

interface ImportModalProps {
  open: boolean;
  existingItems: ProcurementItem[];
  onClose: () => void;
  onConfirm: (rows: ImportedRow[]) => void;
}

export default function ImportModal({ open, existingItems, onClose, onConfirm }: ImportModalProps) {
  const [result, setResult]   = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setResult(null);
    setFileName('');
    setReading(false);
    setDragging(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => { reset(); onClose(); };

  async function readFile(file: File) {
    setReading(true);
    setFileName(file.name);
    try {
      setResult(await importWorkbook(file, existingItems));
    } catch (err) {
      setResult({ rows: [], sheetsRead: [], errors: [`Gagal membaca file: ${(err as Error).message}`] });
    } finally {
      setReading(false);
    }
  }

  const updateRow = (index: number, patch: Partial<ImportedRow>) => {
    setResult(prev => prev && {
      ...prev,
      rows: prev.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    });
  };

  const rows = result?.rows ?? [];
  const selected = rows.filter(r => r.include);
  const willUpdate = selected.filter(r => r.matchesItemId).length;
  const willInsert = selected.length - willUpdate;
  const duplicates = rows.filter(r => r.duplicateOf !== undefined).length;
  const needsDiscipline = selected.filter(r => !r.discipline).length;

  const setAll = (include: boolean) => {
    setResult(prev => prev && {
      ...prev,
      // Leave detected duplicates unticked when selecting everything.
      rows: prev.rows.map(r => ({ ...r, include: include && r.duplicateOf === undefined })),
    });
  };

  return (
    <div
      className={`modal-bg${open ? ' open' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="modal modal-wide">
        <div className="modal-head">
          <div className="modal-title">Import dari Excel</div>
          <div className="modal-desc" style={{ marginTop: 4 }}>
            Sistem membaca setiap sheet, mengenali baris header, dan memisahkan disiplin dari
            baris section seperti “A. ELECTRICAL”.
          </div>
        </div>

        <div className="modal-body">
          {/* ── Drop zone ── */}
          {!result && (
            <div
              className={`drop${dragging ? ' over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) readFile(file);
              }}
              onClick={() => inputRef.current?.click()}
            >
              <div className="drop-icon">📄</div>
              <div className="drop-big">
                {reading ? 'Membaca file…' : 'Tarik file Excel ke sini'}
              </div>
              <div className="drop-sm">
                atau klik untuk memilih · format .xlsx
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) readFile(file);
                }}
              />
            </div>
          )}

          {/* ── Errors ── */}
          {result?.errors.map(err => (
            <div className="import-alert crit" key={err}>⚠️ {err}</div>
          ))}

          {/* ── Preview ── */}
          {result && rows.length > 0 && (
            <>
              <div className="import-summary">
                <div className="is-file">
                  <span className="is-name">{fileName}</span>
                  <button className="is-reset" onClick={reset}>Ganti file</button>
                </div>
                <div className="is-stats">
                  <span><b>{rows.length}</b> baris dibaca</span>
                  <span><b>{result.sheetsRead.length}</b> sheet: {result.sheetsRead.join(', ')}</span>
                  {duplicates > 0 && <span className="warn"><b>{duplicates}</b> duplikat</span>}
                </div>
              </div>

              {needsDiscipline > 0 && (
                <div className="import-alert warn">
                  {needsDiscipline} baris belum punya disiplin. Pilih di kolom Disiplin sebelum import.
                </div>
              )}

              <div className="import-toolbar">
                <span className="it-count">
                  <b>{selected.length}</b> dipilih —{' '}
                  {willInsert} item baru
                  {willUpdate > 0 && <>, {willUpdate} memperbarui item yang sudah ada</>}
                </span>
                <span className="it-actions">
                  <button className="btn btn-sm" onClick={() => setAll(true)}>Pilih semua</button>
                  <button className="btn btn-sm" onClick={() => setAll(false)}>Kosongkan</button>
                </span>
              </div>

              <div className="import-table-wrap">
                <table className="import-table">
                  <thead>
                    <tr>
                      <th style={{ width: 34 }}></th>
                      <th style={{ minWidth: 190 }}>Equipment</th>
                      <th style={{ width: 120 }}>Disiplin</th>
                      <th style={{ minWidth: 130 }}>Vendor</th>
                      <th style={{ width: 105 }}>PO No</th>
                      <th style={{ width: 70 }}>Rdns</th>
                      <th style={{ width: 100 }}>FAT</th>
                      <th style={{ width: 100 }}>Delivery</th>
                      <th style={{ minWidth: 150 }}>Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const isDup = row.duplicateOf !== undefined;
                      const fatDate = row.fat.actual || row.fat.plan;
                      const mosDate = row.mos.actual || row.mos.forecast || row.mos.plan;
                      return (
                        <tr
                          key={`${row.sourceSheet}-${row.sourceRow}`}
                          className={[
                            isDup ? 'dup' : '',
                            row.matchesItemId ? 'match' : '',
                            row.include ? '' : 'off',
                          ].filter(Boolean).join(' ')}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={row.include}
                              onChange={e => updateRow(i, { include: e.target.checked })}
                            />
                          </td>
                          <td>
                            <div className="it-desc">{row.desc}</div>
                            <div className="it-src">
                              {row.sourceSheet} · baris {row.sourceRow}
                              {row.matchesItemId && <span className="it-badge match">memperbarui</span>}
                              {isDup && <span className="it-badge dup">duplikat</span>}
                            </div>
                            {row.warnings.map(w => (
                              <div className="it-warn" key={w}>{w}</div>
                            ))}
                          </td>
                          <td>
                            <select
                              className="it-select"
                              value={row.discipline}
                              onChange={e => updateRow(i, { discipline: e.target.value })}
                            >
                              <option value="">— pilih —</option>
                              {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </td>
                          <td>{row.vendor || '—'}</td>
                          <td className="mono">{row.poNo || '—'}</td>
                          <td className="mono center">
                            {row.readinessDoc ? `${Math.round(row.readinessDoc * 100)}%` : '—'}
                          </td>
                          <td className="mono">
                            {fatDate ? fmtDate(fatDate) : '—'}
                            {row.fat.actual && <span className="it-tick">✓</span>}
                          </td>
                          <td className="mono">{mosDate ? fmtDate(mosDate) : '—'}</td>
                          <td className="it-note">{row.statusNote || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={close}>Batal</button>
          <button
            className="btn btn-primary"
            disabled={!selected.length || needsDiscipline > 0}
            onClick={() => { onConfirm(selected); reset(); }}
          >
            {selected.length ? `Import ${selected.length} item` : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
