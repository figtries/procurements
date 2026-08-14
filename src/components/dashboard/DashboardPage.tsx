'use client';

import { useMemo, useState } from 'react';
import type { Anomaly, ProcurementItem, Project } from '@/types';
import {
  STATUS_LABELS, buildLookahead, buildSCurve, computeDeviation, detectAnomalies,
  disciplineBreakdown, fmtDate, getDisciplineStyle, milestoneStats, today, vendorStats,
  daysDiff,
} from '@/lib/utils';
import SCurveChart from './SCurveChart';
import StatTile from './StatTile';

interface DashboardPageProps {
  project: Project | null;
  items: ProcurementItem[];
  onOpenItem: (item: ProcurementItem) => void;
  onImport: () => void;
  onExport: () => void;
  exporting: boolean;
}

const LOOKAHEAD_OPTIONS = [
  { weeks: 4, label: '4 minggu' },
  { weeks: 8, label: '8 minggu' },
  { weeks: 13, label: 'Kuartal' },
] as const;

export default function DashboardPage({
  project, items, onOpenItem, onImport, onExport, exporting,
}: DashboardPageProps) {
  const [weeks, setWeeks] = useState<number>(4);

  const deviation   = useMemo(() => computeDeviation(items, project), [items, project]);
  const curve       = useMemo(() => buildSCurve(items, project), [items, project]);
  const milestones  = useMemo(() => milestoneStats(items), [items]);
  const disciplines = useMemo(() => disciplineBreakdown(items), [items]);
  const lookahead   = useMemo(() => buildLookahead(items, weeks), [items, weeks]);
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

  const uniqueVendors = new Set(items.map(i => i.vendor.trim()).filter(Boolean)).size;
  const daysToHandover = project?.handover ? daysDiff(today(), project.handover) : null;

  /* Show the worst few; the rest stay one click away in Overview. */
  const topAnomalies = anomalies.slice(0, 6);
  const topVendors = vendors.slice(0, 5);

  if (!items.length) {
    return (
      <section className="page">
        <DashboardHeader
          project={project}
          onImport={onImport}
          onExport={onExport}
          exporting={exporting}
          canExport={false}
        />
        <div className="empty">
          <div className="empty-icon">📊</div>
          <div>Belum ada item untuk dirangkum.</div>
          <div style={{ fontSize: 13, marginTop: 8, color: 'var(--text-tertiary)' }}>
            Import file Excel yang sudah ada, atau tambahkan item dari halaman Overview.
          </div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={onImport}>
            Import Excel
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <DashboardHeader
        project={project}
        onImport={onImport}
        onExport={onExport}
        exporting={exporting}
        canExport
      />

      {/* ── Deviasi + kurva-S ── */}
      <div className="hero-row">
        <div className={`card dev-hero${deviation.deviation < 0 ? ' behind' : ' ahead'}`}>
          <div className="dev-eyebrow">Deviasi terhadap rencana</div>
          <div className="dev-big">
            {deviation.deviation > 0 ? '+' : deviation.deviation < 0 ? '−' : ''}
            {Math.abs(deviation.deviation)}<span className="pct">%</span>
          </div>
          <div className="dev-caption">
            {deviation.deviation < 0 ? (
              <>
                Realisasi tertinggal dari kurva rencana
                {deviation.slipDays > 0 && <> — setara <b>±{deviation.slipDays} hari</b> keterlambatan</>}.
              </>
            ) : deviation.deviation > 0 ? (
              <>Realisasi mendahului rencana. Jadwal aman.</>
            ) : (
              <>Realisasi tepat di garis rencana.</>
            )}
          </div>

          <div className="dev-split">
            <div>
              <div className="dev-cell-label">Rencana</div>
              <div className="dev-cell-value plan">{deviation.planPct}%</div>
            </div>
            <div>
              <div className="dev-cell-label">Aktual</div>
              <div className="dev-cell-value act">{deviation.actualPct}%</div>
            </div>
          </div>

          <div className="dev-bars">
            <div className="dev-bar-row">
              <span className="dev-bar-key">Plan</span>
              <span className="dev-bar"><i className="plan" style={{ width: `${deviation.planPct}%` }} /></span>
            </div>
            <div className="dev-bar-row">
              <span className="dev-bar-key">Act</span>
              <span className="dev-bar"><i className="act" style={{ width: `${deviation.actualPct}%` }} /></span>
            </div>
          </div>

          {project?.handover && (
            <div className="dev-foot">
              Target handover <b>{fmtDate(project.handover)}</b>
              {daysToHandover !== null && (
                daysToHandover >= 0 ? <> · sisa {daysToHandover} hari</> : <> · lewat {Math.abs(daysToHandover)} hari</>
              )}
            </div>
          )}
        </div>

        <div className="card curve-card">
          <div className="card-head">
            <div className="card-title">Kurva-S · Rencana vs Realisasi</div>
            <div className="legend">
              <span className="lg"><span className="swatch plan" />Rencana</span>
              <span className="lg"><span className="swatch act" />Realisasi</span>
              <span className="lg"><span className="swatch fc" />Proyeksi</span>
            </div>
          </div>
          <div className="card-sub">
            Progres kumulatif seluruh item, dibobot rata dari tanggal milestone
          </div>
          <SCurveChart points={curve} />
        </div>
      </div>

      {/* ── Tiles ── */}
      <div className="tiles">
        <StatTile
          label="Total Item" value={items.length}
          sub={`${disciplines.length} disiplin · ${uniqueVendors} vendor`} variant="accent"
        />
        <StatTile
          label="On Site" value={counts.onsite}
          sub={items.length ? `${Math.round((counts.onsite / items.length) * 100)}% terkirim` : '—'}
          variant={counts.onsite > 0 ? 'good' : 'default'}
        />
        <StatTile label="On Track" value={counts.ontrack} sub="Sesuai jadwal" />
        <StatTile
          label="At Risk" value={counts.atrisk} sub="FAT ≤ 14 hari"
          variant={counts.atrisk > 0 ? 'warn' : 'default'}
        />
        <StatTile
          label="Late" value={counts.late} sub="Lewat tempo"
          variant={counts.late > 0 ? 'crit' : 'default'}
        />
      </div>

      {/* ── Milestone + disiplin ── */}
      <div className="two-col">
        <div className="card">
          <div className="card-head"><div className="card-title">Posisi milestone</div></div>
          <div className="card-sub">Berapa item sudah melewati tiap tahap, dari {items.length} item</div>

          <div className="ms-list">
            {milestones.map(ms => {
              const pct = (n: number) => (ms.total ? (n / ms.total) * 100 : 0);
              return (
                <div className="ms-item" key={ms.key}>
                  <div className="ms-top">
                    <span className="ms-name">
                      <span className={`code ${ms.key}`}>{ms.label}</span>{ms.name}
                    </span>
                    <span className="ms-count">{ms.done}<span> / {ms.total}</span></span>
                  </div>
                  <div className="ms-track">
                    <i className="done" style={{ width: `${pct(ms.done)}%` }} />
                    <i className="soon" style={{ width: `${pct(ms.scheduled)}%` }} />
                    <i className="late" style={{ width: `${pct(ms.overdue)}%` }} />
                  </div>
                  <div className="ms-legend">
                    <span className="k"><i style={{ background: 'var(--success)' }} />Selesai <b>{ms.done}</b></span>
                    <span className="k"><i style={{ background: 'var(--warning)' }} />Terjadwal <b>{ms.scheduled}</b></span>
                    <span className="k"><i style={{ background: 'var(--danger)' }} />Lewat tempo <b>{ms.overdue}</b></span>
                    {ms.unplanned > 0 && (
                      <span className="k"><i style={{ background: 'var(--separator)' }} />Belum dijadwalkan <b>{ms.unplanned}</b></span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">Sebaran per disiplin</div></div>
          <div className="card-sub">Komposisi status tiap disiplin</div>

          <div className="disc-rows">
            {disciplines.map(d => {
              const style = getDisciplineStyle(d.discipline);
              const w = (n: number) => (d.total ? (n / d.total) * 100 : 0);
              return (
                <div className="disc-row" key={d.discipline}>
                  <span className="disc-tag" style={{ background: style.bg, color: style.color }}>
                    {d.discipline}
                  </span>
                  <span className="disc-stack">
                    <i className="onsite"   style={{ width: `${w(d.counts.onsite)}%` }} />
                    <i className="ontrack"  style={{ width: `${w(d.counts.ontrack)}%` }} />
                    <i className="atrisk"   style={{ width: `${w(d.counts.atrisk)}%` }} />
                    <i className="late"     style={{ width: `${w(d.counts.late)}%` }} />
                    <i className="planning" style={{ width: `${w(d.counts.planning)}%` }} />
                  </span>
                  <span className="disc-n">{d.total}</span>
                </div>
              );
            })}
          </div>

          <div className="ms-legend disc-legend">
            <span className="k"><i style={{ background: 'var(--accent)' }} />On Site</span>
            <span className="k"><i style={{ background: 'var(--success)' }} />On Track</span>
            <span className="k"><i style={{ background: 'var(--warning)' }} />At Risk</span>
            <span className="k"><i style={{ background: 'var(--danger)' }} />Late</span>
            <span className="k"><i style={{ background: 'var(--text-tertiary)' }} />Planning</span>
          </div>
        </div>
      </div>

      {/* ── Lookahead ── */}
      <div className="card section-gap">
        <div className="look-head">
          <div>
            <div className="card-title">Jatuh tempo berikutnya</div>
            <div className="card-sub" style={{ marginBottom: 0 }}>
              Milestone yang harus terjadi, dihitung dari tanggal plan dan forecast tiap item
            </div>
          </div>
          <div className="seg">
            {LOOKAHEAD_OPTIONS.map(o => (
              <button
                key={o.weeks}
                className={weeks === o.weeks ? 'active' : ''}
                onClick={() => setWeeks(o.weeks)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="week-grid">
          {lookahead.slice(0, 4).map(week => (
            <div className={`week-col${week.isCurrent ? ' now' : ''}`} key={week.label}>
              <div className="week-hd">
                <span className="week-label">{week.label}</span>
                <span className="week-date">{week.range}</span>
              </div>
              {week.events.length === 0 ? (
                <div className="week-empty">Tidak ada jadwal.</div>
              ) : (
                week.events.slice(0, 6).map(ev => (
                  <button
                    key={`${ev.itemId}-${ev.kind}`}
                    className={`ev ${ev.overdue ? 'risk' : ev.kind}`}
                    onClick={() => openById(ev.itemId)}
                  >
                    <span className="ev-top">
                      <span className="ev-kind">{ev.label}</span>
                      <span className="ev-day">{ev.overdue ? 'LEWAT' : ev.day}</span>
                    </span>
                    <span className="ev-name">{ev.desc}</span>
                    <span className="ev-vendor">{ev.vendor || '—'}</span>
                  </button>
                ))
              )}
              {week.events.length > 6 && (
                <div className="week-empty">+{week.events.length - 6} lagi</div>
              )}
            </div>
          ))}
        </div>

        {weeks > 4 && (
          <div className="card-note look-note">
            Menampilkan 4 minggu pertama dari {weeks} minggu.{' '}
            {lookahead.slice(4).reduce((s, w) => s + w.events.length, 0)} milestone lain jatuh tempo setelahnya.
          </div>
        )}
      </div>

      {/* ── Anomali ── */}
      <div className="card section-gap">
        <div className="card-head">
          <div className="card-title">Anomali terdeteksi</div>
          <span className="card-count">{anomalies.length} temuan</span>
        </div>
        <div className="card-sub">Dihitung ulang setiap kali data berubah atau file Excel di-import</div>

        {anomalies.length === 0 ? (
          <div className="anom ok">
            <div className="anom-ic">✅</div>
            <div>
              <div className="anom-name">Tidak ada anomali</div>
              <div className="anom-why">Semua item punya jadwal yang wajar dan dokumen yang lengkap.</div>
            </div>
          </div>
        ) : (
          <div className="anom-list">
            {topAnomalies.map((a, idx) => (
              <AnomalyRow key={`${a.itemId}-${a.rule}-${idx}`} anomaly={a} item={byId.get(a.itemId)} onOpen={openById} />
            ))}
            {anomalies.length > topAnomalies.length && (
              <div className="card-note">
                +{anomalies.length - topAnomalies.length} temuan lain. Semuanya ikut tercetak di sheet
                {' '}<b>ANOMALI</b> saat export Excel.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Vendor ── */}
      <div className="card section-gap">
        <div className="card-head">
          <div className="card-title">Vendor perlu ditindaklanjuti</div>
          <span className="card-count">{vendors.length} vendor</span>
        </div>
        <div className="card-sub">Diurutkan dari yang paling berdampak ke jadwal</div>

        <div className="table-scroll">
          <table className="vend-table">
            <thead>
              <tr>
                <th style={{ minWidth: 180 }}>Vendor</th>
                <th style={{ width: 60 }}>Item</th>
                <th style={{ width: 120 }}>Readiness</th>
                <th style={{ width: 110 }}>Slip rata²</th>
                <th className="r" style={{ width: 110 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {topVendors.map(v => {
                const pct = Math.round(v.avgReadiness * 100);
                const tone = pct < 50 ? 'low' : pct < 90 ? 'mid' : '';
                return (
                  <tr key={v.vendor}>
                    <td>
                      <div className="vend-name">{v.vendor}</div>
                      <div className="vend-sub">{v.itemNames.slice(0, 3).join(' · ')}</div>
                    </td>
                    <td className="num">{v.items}</td>
                    <td>
                      <div className="readiness-cell">
                        <span className="mini-bar"><i className={tone} style={{ width: `${pct}%` }} /></span>
                        <span className="num">{pct}%</span>
                      </div>
                    </td>
                    <td className={`num${v.avgSlipDays > 0 ? ' slip' : ''}`}>
                      {v.avgSlipDays > 0 ? `+${v.avgSlipDays} hari` : 'tepat waktu'}
                    </td>
                    <td className="r">
                      <span className={`badge b-${v.worstStatus}`}>
                        <span className="bdot" />{STATUS_LABELS[v.worstStatus]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ─────────────── Sub-components ─────────────── */

function DashboardHeader({
  project, onImport, onExport, exporting, canExport,
}: {
  project: Project | null;
  onImport: () => void;
  onExport: () => void;
  exporting: boolean;
  canExport: boolean;
}) {
  return (
    <div className="page-header">
      {project && (
        <p className="page-eyebrow">
          {[project.name, project.client, project.location].filter(Boolean).join(' · ')}
          {project.revision ? <span className="rev-chip">rev.{project.revision}</span> : null}
        </p>
      )}
      <div className="page-title-row">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">
            Ringkasan posisi sekarang terhadap rencana, dan apa yang jatuh tempo berikutnya.
          </p>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={onImport}>↓ Import Excel</button>
          <button className="btn btn-primary" onClick={onExport} disabled={!canExport || exporting}>
            {exporting ? 'Menyiapkan…' : '↑ Export Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AnomalyRow({
  anomaly, item, onOpen,
}: {
  anomaly: Anomaly;
  item: ProcurementItem | undefined;
  onOpen: (id: string) => void;
}) {
  return (
    <div className={`anom ${anomaly.severity}`}>
      <div className="anom-ic">{anomaly.icon}</div>
      <div>
        <div className="anom-name">
          {item?.desc ?? 'Item tidak ditemukan'}
          {item?.vendor && <span className="vend">· {item.vendor}</span>}
          {item?.poNo && <span className="vend">· {item.poNo}</span>}
        </div>
        <div className="anom-why">{anomaly.detail}</div>
      </div>
      {item && (
        <button className="anom-act" onClick={() => onOpen(anomaly.itemId)}>Buka item</button>
      )}
    </div>
  );
}
