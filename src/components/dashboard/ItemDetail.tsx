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

        <div className="detail-grid">
          <div><div className="dfield-label">Supplier / Vendor</div><div className="dfield-value">{item.vendor || '—'}</div></div>
          <div><div className="dfield-label">Brand</div><div className="dfield-value">{item.brand || '—'}</div></div>
          <div><div className="dfield-label">Qty / Unit</div><div className="dfield-value">{item.qty} {item.unit}</div></div>
          <div><div className="dfield-label">Delivery Term</div><div className="dfield-value">{item.delivery || '—'}</div></div>
          <div><div className="dfield-label">PO Number</div><div className="dfield-value">{item.poNo || '—'}</div></div>
          <div><div className="dfield-label">PO Date</div><div className="dfield-value">{fmtDate(item.poDate)}</div></div>
        </div>
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
