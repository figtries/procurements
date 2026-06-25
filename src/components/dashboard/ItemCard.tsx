import type { ProcurementItem } from '@/types';
import { getDisciplineStyle, fmtDate, getNextMilestone } from '@/lib/utils';
import Badge from './Badge';
import ProgBar from './ProgBar';

interface ItemCardProps {
  item: ProcurementItem;
  onClick: () => void;
}

export default function ItemCard({ item, onClick }: ItemCardProps) {
  const discStyle = getDisciplineStyle(item.discipline);
  const nextMile = getNextMilestone(item);

  return (
    <div className={`item-card ${item.status}`} onClick={onClick}>
      <div className="item-info">
        <div className="item-name">
          <span
            className="item-disc-tag"
            style={{ background: discStyle.bg, color: discStyle.color }}
          >
            {item.discipline}
          </span>
          {item.desc}
        </div>
        <div className="item-meta">
          {item.qty} {item.unit} · PO: {item.poNo || '—'} · {fmtDate(item.poDate)}
        </div>
      </div>

      <div className="item-vendor">
        <div className="v-name">{item.vendor}</div>
        {item.brand && <div className="v-brand">{item.brand}</div>}
      </div>

      <div className="prog-wrap">
        <div className="prog-top">
          <span>Progress</span>
          <span>{item.progress}%</span>
        </div>
        <ProgBar value={item.progress} />
      </div>

      <div className="status-cell">
        <Badge status={item.status} />
        {nextMile && <div className="next-mile">{nextMile}</div>}
      </div>

      <div className="chev">›</div>
    </div>
  );
}
