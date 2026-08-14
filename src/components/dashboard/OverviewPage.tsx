'use client';

import { CheckCircle2, Clock, PackageSearch, Plus, Search, TriangleAlert, X } from 'lucide-react';
import type { GroupBy, ItemStatus, ProcurementItem } from '@/types';
import { STATUS_LABELS, computeOverallProgress, getDisciplineStyle } from '@/lib/procurement';
import StatTile from './StatTile';
import ItemCard from './ItemCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** Select needs a non-empty value, so "no filter" gets its own sentinel. */
const ALL = '__all__';

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

/** Colour the group heading by whatever the list is grouped on. */
function groupHeadStyle(groupBy: GroupBy, key: string): { bg: string; color: string } {
  if (groupBy === 'discipline') return getDisciplineStyle(key);
  if (groupBy === 'status') {
    return { bg: `var(--st-${key}-bg)`, color: `var(--st-${key}-fg)` };
  }
  return { bg: 'var(--muted)', color: 'var(--muted-foreground)' };
}

function WarnBanners({
  late, atrisk, total, hasProject, onFilterLate, onFilterRisk,
}: {
  late: number; atrisk: number; total: number; hasProject: boolean;
  onFilterLate: () => void; onFilterRisk: () => void;
}) {
  if (!hasProject || total === 0) return null;

  if (late === 0 && atrisk === 0) {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-ontrack/25 bg-ontrack-bg px-4 py-3.5">
        <CheckCircle2 className="size-5 shrink-0 text-ontrack-fg" />
        <p className="text-sm text-ontrack-fg">
          <span className="font-semibold">Semua item on track.</span> Tidak ada isu kritis.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-5 space-y-2.5">
      {late > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-late/20 bg-late-bg px-4 py-3.5">
          <TriangleAlert className="size-5 shrink-0 text-late-fg" />
          <p className="flex-1 text-sm text-late-fg">
            <span className="font-semibold">{late} item lewat tempo.</span>{' '}
            Perlu tindak lanjut segera ke vendor.
          </p>
          <Button size="sm" variant="ghost" className="bg-background/70 hover:bg-background" onClick={onFilterLate}>
            Lihat item late
          </Button>
        </div>
      )}
      {atrisk > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-atrisk/25 bg-atrisk-bg px-4 py-3.5">
          <Clock className="size-5 shrink-0 text-atrisk-fg" />
          <p className="flex-1 text-sm text-atrisk-fg">
            <span className="font-semibold">{atrisk} item at risk.</span>{' '}
            Tenggat FAT dalam 14 hari ke depan.
          </p>
          <Button size="sm" variant="ghost" className="bg-background/70 hover:bg-background" onClick={onFilterRisk}>
            Lihat item at risk
          </Button>
        </div>
      )}
    </div>
  );
}

export default function OverviewPage({
  projectName, projectItems, filteredItems, grouped, groupBy, search,
  filterStatus, filterDisc, filterVendor, hasFilters, uniqueDiscs, uniqueVendors,
  hasProject, onSearch, onFilterStatus, onFilterDisc, onFilterVendor,
  onClearFilters, onGroupBy, onAddProject, onAddItem, onOpenDetail,
}: OverviewPageProps) {
  const total   = projectItems.length;
  const onsite  = projectItems.filter(i => i.status === 'onsite').length;
  const ontrack = projectItems.filter(i => i.status === 'ontrack').length;
  const late    = projectItems.filter(i => i.status === 'late').length;
  const atrisk  = projectItems.filter(i => i.status === 'atrisk').length;
  const overallProg = computeOverallProgress(projectItems);

  return (
    <div className="animate-page-in">
      {/* Header */}
      <div className="mb-6">
        {projectName && <p className="mb-2 text-sm text-muted-foreground">{projectName}</p>}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Procurement Overview</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Semua equipment yang dipesan, vendor, progres, dan jadwalnya.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onAddProject}>
              <Plus className="size-4" />
              Project
            </Button>
            <Button onClick={onAddItem}>
              <Plus className="size-4" />
              Tambah Item
            </Button>
          </div>
        </div>
      </div>

      <WarnBanners
        late={late}
        atrisk={atrisk}
        total={total}
        hasProject={hasProject}
        onFilterLate={() => onFilterStatus('late')}
        onFilterRisk={() => onFilterStatus('atrisk')}
      />

      {/* Tiles */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Total Item" value={total} sub={`${overallProg}% keseluruhan`} variant="accent" />
        <StatTile label="On Site" value={onsite} sub="Terkirim" variant={onsite > 0 ? 'good' : 'default'} />
        <StatTile label="On Track" value={ontrack} sub="Berjalan" />
        <StatTile label="At Risk" value={atrisk} sub="Perlu ditinjau" variant={atrisk > 0 ? 'warn' : 'default'} />
        <StatTile label="Late" value={late} sub="Lewat tempo" variant={late > 0 ? 'crit' : 'default'} />
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Cari item, vendor, brand, PO…"
          className="h-11 pl-9"
        />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={filterStatus || ALL} onValueChange={v => onFilterStatus(v === ALL || !v ? '' : v)}>
          <SelectTrigger className="w-[10.5rem]"><SelectValue placeholder="Semua status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua status</SelectItem>
            {(Object.entries(STATUS_LABELS) as [ItemStatus, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterDisc || ALL} onValueChange={v => onFilterDisc(v === ALL || !v ? '' : v)}>
          <SelectTrigger className="w-[10.5rem]"><SelectValue placeholder="Semua disiplin" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua disiplin</SelectItem>
            {uniqueDiscs.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterVendor || ALL} onValueChange={v => onFilterVendor(v === ALL || !v ? '' : v)}>
          <SelectTrigger className="w-[14rem]"><SelectValue placeholder="Semua vendor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua vendor</SelectItem>
            {uniqueVendors.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-muted-foreground">
            <X className="size-3.5" />
            Hapus filter
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline">
            Kelompokkan
          </span>
          <Tabs value={groupBy} onValueChange={v => onGroupBy(v as GroupBy)}>
            <TabsList>
              <TabsTrigger value="discipline">Disiplin</TabsTrigger>
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="vendor">Vendor</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Item groups */}
      {filteredItems.length === 0 ? (
        <Card className="py-14">
          <CardContent className="flex flex-col items-center gap-2 text-center">
            <PackageSearch className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {total === 0
                ? 'Belum ada item. Klik "Tambah Item" atau import dari Excel.'
                : 'Tidak ada item yang cocok dengan filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => {
            const style = groupHeadStyle(groupBy, group.key);
            return (
              <section key={group.key}>
                <div className="mb-2.5 flex items-center gap-2.5">
                  <span
                    className="rounded-md px-2.5 py-1 text-[13px] font-semibold"
                    style={{ background: style.bg, color: style.color }}
                  >
                    {group.label}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold tabular"
                    style={{ background: style.bg, color: style.color }}
                  >
                    {group.items.length} item
                  </span>
                </div>
                <div className="space-y-2">
                  {group.items.map(item => (
                    <ItemCard key={item.id} item={item} onClick={() => onOpenDetail(item)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
