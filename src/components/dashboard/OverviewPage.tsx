import type { ProcurementItem, ItemStatus, GroupBy } from '@/types';
import { STATUS_LABELS, getDisciplineStyle, computeOverallProgress } from '@/lib/utils';
import StatTile from './StatTile';
import ItemCard from './ItemCard';

interface WarnBannersProps {
  late: number;
  atrisk: number;
  total: number;
  hasProject: boolean;
  onFilterLate: () => void;
  onFilterRisk: () => void;
}

function WarnBanners({ late, atrisk, total, hasProject, onFilterLate, onFilterRisk }: WarnBannersProps) {
  if (!hasProject || total === 0) return null;

  return (
    <>
      {late > 0 && (
        <div className="warn-banner crit">
          <div className="warn-icon">⚠️</div>
          <div className="warn-text">
            <strong>{late} item{late > 1 ? 's' : ''} late.</strong> Immediate follow-up required with vendors.
          </div>
          <div className="warn-chips">
            <button className="warn-chip" onClick={onFilterLate}>Show Late Items</button>
          </div>
        </div>
      )}
      {atrisk > 0 && (
        <div className="warn-banner">
          <div className="warn-icon">⏳</div>
          <div className="warn-text">
            <strong>{atrisk} item{atrisk > 1 ? 's' : ''} at risk.</strong> FAT deadlines approaching within 14 days.
          </div>
          <div className="warn-chips">
            <button className="warn-chip" onClick={onFilterRisk}>Show At Risk</button>
          </div>
        </div>
      )}
      {late === 0 && atrisk === 0 && total > 0 && (
        <div className="warn-banner ok">
          <div className="warn-icon">✅</div>
          <div className="warn-text"><strong>All items on track.</strong> No critical issues detected.</div>
        </div>
      )}
    </>
  );
}

interface OverviewPageProps {
  projectName: string;
  projectItems: ProcurementItem[];
  filteredItems: ProcurementItem[];
  grouped: Array<{ key: string; label: string; items: ProcurementItem[] }>;
  groupBy: GroupBy;
  search: string;
  filterStatus: string;
  filterDisc: string;
  filterVendor: string;
  hasFilters: boolean;
  uniqueDiscs: string[];
  uniqueVendors: string[];
  hasProject: boolean;
  onSearch: (v: string) => void;
  onFilterStatus: (v: string) => void;
  onFilterDisc: (v: string) => void;
  onFilterVendor: (v: string) => void;
  onClearFilters: () => void;
  onGroupBy: (g: GroupBy) => void;
  onAddProject: () => void;
  onAddItem: () => void;
  onOpenDetail: (item: ProcurementItem) => void;
}

function groupHeadStyle(groupBy: GroupBy, key: string): { bg: string; color: string } {
  if (groupBy === 'discipline') {
    return getDisciplineStyle(key);
  }
  if (groupBy === 'status') {
    const map: Record<string, { bg: string; color: string }> = {
      late:     { bg: 'var(--danger-soft)',  color: 'var(--danger-text)' },
      atrisk:   { bg: 'var(--warning-soft)', color: 'var(--warning-text)' },
      ontrack:  { bg: 'var(--success-soft)', color: 'var(--success-text)' },
      onsite:   { bg: 'var(--accent-soft)',  color: 'var(--accent)' },
      planning: { bg: 'var(--surface-hover)',color: 'var(--text-secondary)' },
    };
    return map[key] ?? map.planning;
  }
  return { bg: 'var(--surface-hover)', color: 'var(--text-secondary)' };
}

export default function OverviewPage({
  projectName,
  projectItems,
  filteredItems,
  grouped,
  groupBy,
  search,
  filterStatus,
  filterDisc,
  filterVendor,
  hasFilters,
  uniqueDiscs,
  uniqueVendors,
  hasProject,
  onSearch,
  onFilterStatus,
  onFilterDisc,
  onFilterVendor,
  onClearFilters,
  onGroupBy,
  onAddProject,
  onAddItem,
  onOpenDetail,
}: OverviewPageProps) {
  const total = projectItems.length;
  const onsite = projectItems.filter(i => i.status === 'onsite').length;
  const ontrack = projectItems.filter(i => i.status === 'ontrack').length;
  const late = projectItems.filter(i => i.status === 'late').length;
  const atrisk = projectItems.filter(i => i.status === 'atrisk').length;
  const overallProg = computeOverallProgress(projectItems);

  return (
    <section className="page">
      {/* Header */}
      <div className="page-header">
        {projectName && <p className="page-eyebrow">{projectName}</p>}
        <div className="page-title-row">
          <div>
            <h1 className="page-title">Procurement Overview</h1>
            <p className="page-sub">All ordered equipment, vendors, progress, and schedules.</p>
          </div>
          <div className="actions">
            <button className="btn btn-secondary" onClick={onAddProject}>+ Add Project</button>
            <button className="btn btn-primary" onClick={onAddItem}>+ Add Item</button>
          </div>
        </div>
      </div>

      {/* Warning banners */}
      <WarnBanners
        late={late}
        atrisk={atrisk}
        total={total}
        hasProject={hasProject}
        onFilterLate={() => onFilterStatus('late')}
        onFilterRisk={() => onFilterStatus('atrisk')}
      />

      {/* Tiles */}
      <div className="tiles">
        <StatTile label="Total Items" value={total} sub={`${overallProg}% overall`} variant="accent" />
        <StatTile label="On Site"     value={onsite}  sub="Delivered"    variant={onsite  > 0 ? 'good' : 'default'} />
        <StatTile label="On Track"    value={ontrack} sub="Progressing" />
        <StatTile label="At Risk"     value={atrisk}  sub="Review needed" variant={atrisk > 0 ? 'warn' : 'default'} />
        <StatTile label="Late"        value={late}    sub="Overdue"      variant={late   > 0 ? 'crit' : 'default'} />
      </div>

      {/* Search */}
      <div className="search-row">
        <input
          type="text"
          className="search"
          placeholder="Search items, vendor, brand, PO…"
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div className="filter-row">
        <select className="filter-sel" value={filterStatus} onChange={e => onFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {(Object.entries(STATUS_LABELS) as [ItemStatus, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select className="filter-sel" value={filterDisc} onChange={e => onFilterDisc(e.target.value)}>
          <option value="">All Disciplines</option>
          {uniqueDiscs.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="filter-sel" value={filterVendor} onChange={e => onFilterVendor(e.target.value)}>
          <option value="">All Vendors</option>
          {uniqueVendors.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <button
          className={`filter-clear${!hasFilters ? ' hidden-keep-space' : ''}`}
          onClick={onClearFilters}
        >
          ✕ Clear filters
        </button>
      </div>

      {/* Group toggle */}
      <div className="group-row">
        <span className="group-label">Group by</span>
        <div className="group-toggle">
          {(['discipline', 'status', 'vendor'] as GroupBy[]).map(g => (
            <button
              key={g}
              className={`group-opt${groupBy === g ? ' active' : ''}`}
              onClick={() => onGroupBy(g)}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Item groups */}
      {filteredItems.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📦</div>
          <div>{total === 0 ? 'No items yet. Click "Add Item" to get started.' : 'No items match your filters.'}</div>
        </div>
      ) : (
        <div>
          {grouped.map(group => {
            const style = groupHeadStyle(groupBy, group.key);
            return (
              <div key={group.key} className="disc-group">
                <div className="disc-head">
                  <span className="disc-title" style={style as React.CSSProperties}>{group.label}</span>
                  <span className="disc-count" style={style as React.CSSProperties}>
                    {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {group.items.map(item => (
                  <ItemCard key={item.id} item={item} onClick={() => onOpenDetail(item)} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
