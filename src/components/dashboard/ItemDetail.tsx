import type { ProcurementItem } from '@/types';
import { getDisciplineStyle, fmtDate } from '@/lib/utils';
import Badge from './Badge';
import MilestoneRow from './MilestoneRow';

interface ItemDetailProps {
  item: ProcurementItem;
  onBack: () => void;
  onEdit: (item: ProcurementItem) => void;
  onDelete: (item: ProcurementItem) => void;
}

export default function ItemDetail({ item, onBack, onEdit, onDelete }: ItemDetailProps) {
  const discStyle = getDisciplineStyle(item.discipline);
  const isLate = item.status === 'late';
  const isAtRisk = item.status === 'atrisk';

  const readinessPct = Math.round((item.readinessDoc || 0) * 100);
  const readinessTone = readinessPct < 50 ? 'low' : readinessPct < 90 ? 'mid' : '';
  /** Goods arrived but the delivery order was never recorded. */
  const needsDo = !!item.mos.actual && !item.doNo.trim();

  return (
    <div>
      <button className="back-btn" onClick={onBack}>← Back to Overview</button>

      {(isLate || isAtRisk) && (
        <div className={`detail-warn ${item.status}`}>
          <span>{isLate ? '⚠️' : '⏳'}</span>
          <div>
            {isLate
              ? <><strong>Item is late.</strong> One or more milestone deadlines have passed without an actual date.</>
              : <><strong>At risk.</strong> FAT is due within 14 days. Confirm readiness with vendor.</>}
          </div>
        </div>
      )}

      <div className="detail-hero">
        <div className="detail-top">
          <div>
            <Badge status={item.status} />
            <div className="detail-name">
              <span
                className="item-disc-tag"
                style={{ background: discStyle.bg, color: discStyle.color }}
              >
                {item.discipline}
              </span>
              {item.desc}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={() => onEdit(item)}>Edit</button>
            <button className="btn btn-sm btn-danger" onClick={() => onDelete(item)}>Delete</button>
          </div>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 20 }}>
          <div className="dp-top">
            <div className="dp-label">
              Overall Progress
              <span className="dp-hint">Based on milestone completion</span>
            </div>
            <span className="dp-pct">{item.progress}%</span>
          </div>
          <div className="dp-bar">
            <div className="dp-fill" style={{ width: `${item.progress}%` }} />
          </div>
        </div>

        {/* Document readiness — the 0–1 figure client sheets track per item */}
        <div className="readiness-block">
          <div className="dp-top">
            <div className="dp-label">
              Document Readiness
              <span className="dp-hint">Kelengkapan dokumen vendor</span>
            </div>
            <span className={`dp-pct${readinessTone ? ` ${readinessTone}` : ''}`}>{readinessPct}%</span>
          </div>
          <div className="dp-bar">
            <div className={`dp-fill${readinessTone ? ` ${readinessTone}` : ''}`} style={{ width: `${readinessPct}%` }} />
          </div>
        </div>

        <div className="detail-grid">
          <div><div className="dfield-label">Supplier / Vendor</div><div className="dfield-value">{item.vendor || '—'}</div></div>
          <div><div className="dfield-label">Brand</div><div className="dfield-value">{item.brand || '—'}</div></div>
          <div><div className="dfield-label">Qty / Unit</div><div className="dfield-value">{item.qty} {item.unit}</div></div>
          <div><div className="dfield-label">Delivery Term</div><div className="dfield-value">{item.delivery || '—'}</div></div>
          <div><div className="dfield-label">PO Number</div><div className="dfield-value">{item.poNo || '—'}</div></div>
          <div><div className="dfield-label">PO Date</div><div className="dfield-value">{fmtDate(item.poDate)}</div></div>
          <div>
            <div className="dfield-label">No. DO / Delivery Order</div>
            <div className={`dfield-value${item.doNo ? '' : ' muted'}`}>{item.doNo || '—'}</div>
          </div>
          <div>
            <div className="dfield-label">Material On Site</div>
            <div className="dfield-value">{item.mos.actual ? fmtDate(item.mos.actual) : 'Belum tiba'}</div>
          </div>
        </div>
      </div>

      {/* Delivery Order — the paperwork that proves the goods actually arrived */}
      <div className="section-card">
        <div className="section-title">Delivery Order</div>
        <div className="section-sub">Bukti pengiriman dari vendor</div>

        {item.doNo ? (
          <div className="do-list">
            {item.doNo.split(/[\n;]+|\s{2,}|&/).map(s => s.trim()).filter(Boolean).map((no, i) => (
              <div className="do-chip" key={`${no}-${i}`}>
                <span className="do-ic">📦</span>
                <span className="do-no">{no}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={`do-empty${needsDo ? ' warn' : ''}`}>
            {needsDo
              ? 'Material tercatat sudah on site, tapi nomor DO belum diisi. Lengkapi lewat tombol Edit.'
              : 'Belum ada nomor DO. Akan terisi setelah vendor mengirim surat jalan.'}
          </div>
        )}

        {item.termOfPayment && (
          <>
            <div className="section-title do-term-head">Term of Payment</div>
            <p className="do-term">{item.termOfPayment}</p>
          </>
        )}
      </div>

      {item.statusNote && (
        <div className="section-card">
          <div className="section-title">Status Note</div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {item.statusNote}
          </p>
        </div>
      )}

      <div className="section-card">
        <div className="section-title">Milestone Schedule</div>
        <div className="section-sub">FAT → RTS → MOS</div>
        <div className="timeline">
          <MilestoneRow name="FAT — Factory Acceptance Test" ms={item.fat} index={0} />
          <MilestoneRow name="RTS — Ready To Ship" ms={item.rts} index={1} />
          <MilestoneRow name="MOS — Material On Site" ms={item.mos} index={2} />
        </div>
      </div>
    </div>
  );
}
