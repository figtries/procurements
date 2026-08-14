'use client';

import { ViewTransition, useTransition } from 'react';
import { CheckCircle2, Clock, PackageSearch, Plus, Search, TriangleAlert, X } from 'lucide-react';
import type { GroupBy, ItemStatus, ProcurementItem } from '@/types';
import { STATUS_LABELS, computeOverallProgress, getDisciplineStyle } from '@/lib/procurement';
import StatTile from './StatTile';
import ItemCard from './ItemCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

/**
 * Base UI renders a select's raw value unless the root is given an item map,
 * so every filter passes one and uses `null` for "no filter".
 */
type FilterItem = { value: string | null; label: string };

function toItems(values: string[], allLabel: string): FilterItem[] {
  return [{ value: null, label: allLabel }, ...values.map(v => ({ value: v, label: v }))];
}

function FilterSelect({
  items, value, placeholder, className, onChange,
}: {
  items: FilterItem[];
  value: string;
  placeholder: string;
  className?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select
      items={items}
      value={value || null}
      onValueChange={v => onChange((v as string | null) ?? '')}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map(item => (
          <SelectItem key={item.value ?? '__all__'} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
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
      <Alert className="mb-5 border-ontrack/25 bg-ontrack-bg text-ontrack-fg animate-in fade-in slide-in-from-top-1">
        <CheckCircle2 />
        <AlertTitle>All items on track.</AlertTitle>
        <AlertDescription className="text-ontrack-fg/80">
          Nothing critical needs your attention.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mb-5 space-y-2.5">
      {late > 0 && (
        <Alert className="border-late/20 bg-late-bg text-late-fg animate-in fade-in slide-in-from-top-1">
          <TriangleAlert />
          <AlertTitle>{late} item{late === 1 ? '' : 's'} overdue.</AlertTitle>
          <AlertDescription className="text-late-fg/80">
            Follow up with the vendors now.
          </AlertDescription>
          <Button
            size="sm" variant="ghost"
            className="col-start-2 row-start-3 mt-2 justify-self-start bg-background/70 hover:bg-background"
            onClick={onFilterLate}
          >
            Show overdue
          </Button>
        </Alert>
      )}
      {atrisk > 0 && (
        <Alert className="border-atrisk/25 bg-atrisk-bg text-atrisk-fg animate-in fade-in slide-in-from-top-1">
          <Clock />
          <AlertTitle>{atrisk} item{atrisk === 1 ? '' : 's'} at risk.</AlertTitle>
          <AlertDescription className="text-atrisk-fg/80">
            FAT falls due within the next 14 days.
          </AlertDescription>
          <Button
            size="sm" variant="ghost"
            className="col-start-2 row-start-3 mt-2 justify-self-start bg-background/70 hover:bg-background"
            onClick={onFilterRisk}
          >
            Show at risk
          </Button>
        </Alert>
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
  /** Filtering runs in a transition so the list crossfades instead of snapping. */
  const [, startFilter] = useTransition();

  const total   = projectItems.length;
  const onsite  = projectItems.filter(i => i.status === 'onsite').length;
  const ontrack = projectItems.filter(i => i.status === 'ontrack').length;
  const late    = projectItems.filter(i => i.status === 'late').length;
  const atrisk  = projectItems.filter(i => i.status === 'atrisk').length;
  const overallProg = computeOverallProgress(projectItems);

  const statusItems: FilterItem[] = [
    { value: null, label: 'All statuses' },
    ...(Object.entries(STATUS_LABELS) as [ItemStatus, string][])
      .map(([value, label]) => ({ value, label })),
  ];

  /** Key changes whenever the visible set does, which drives the crossfade. */
  const listKey = `${groupBy}|${filterStatus}|${filterDisc}|${filterVendor}|${search}`;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        {projectName && <p className="mb-2 text-sm text-muted-foreground">{projectName}</p>}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Procurement Overview</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every ordered item, its vendor, progress, and schedule.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onAddProject}>
              <Plus className="size-4" />
              Project
            </Button>
            <Button onClick={onAddItem}>
              <Plus className="size-4" />
              Add item
            </Button>
          </div>
        </div>
      </div>

      <WarnBanners
        late={late}
        atrisk={atrisk}
        total={total}
        hasProject={hasProject}
        onFilterLate={() => startFilter(() => onFilterStatus('late'))}
        onFilterRisk={() => startFilter(() => onFilterStatus('atrisk'))}
      />

      {/* Tiles */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Total items" value={total} sub={`${overallProg}% overall`} />
        <StatTile label="On Site" value={onsite} sub="Delivered" variant={onsite > 0 ? 'good' : 'default'} />
        <StatTile label="On Track" value={ontrack} sub="Progressing" />
        <StatTile label="At Risk" value={atrisk} sub="Needs review" variant={atrisk > 0 ? 'warn' : 'default'} />
        <StatTile label="Late" value={late} sub="Overdue" variant={late > 0 ? 'crit' : 'default'} />
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => startFilter(() => onSearch(e.target.value))}
          placeholder="Search items, vendor, brand, PO…"
          className="h-11 pl-9"
        />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterSelect
          items={statusItems}
          value={filterStatus}
          placeholder="All statuses"
          className="w-[10.5rem]"
          onChange={v => startFilter(() => onFilterStatus(v))}
        />
        <FilterSelect
          items={toItems(uniqueDiscs, 'All disciplines')}
          value={filterDisc}
          placeholder="All disciplines"
          className="w-[11rem]"
          onChange={v => startFilter(() => onFilterDisc(v))}
        />
        <FilterSelect
          items={toItems(uniqueVendors, 'All vendors')}
          value={filterVendor}
          placeholder="All vendors"
          className="w-[14rem]"
          onChange={v => startFilter(() => onFilterVendor(v))}
        />

        {hasFilters && (
          <Button
            variant="ghost" size="sm"
            className="text-muted-foreground animate-in fade-in zoom-in-95"
            onClick={() => startFilter(onClearFilters)}
          >
            <X className="size-3.5" />
            Clear filters
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline">
            Group by
          </span>
          <Tabs value={groupBy} onValueChange={v => startFilter(() => onGroupBy(v as GroupBy))}>
            <TabsList>
              <TabsTrigger value="discipline">Discipline</TabsTrigger>
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="vendor">Vendor</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Item groups */}
      <ViewTransition key={listKey} name="item-list" share="auto" enter="auto" exit="auto" default="none">
        <div>
          {filteredItems.length === 0 ? (
            <Card className="py-14">
              <CardContent className="flex flex-col items-center gap-2 text-center">
                <PackageSearch className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  {total === 0
                    ? 'No items yet. Add one, or import from Excel.'
                    : 'No items match these filters.'}
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
                        {group.items.length} item{group.items.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item, i) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          index={i}
                          onClick={() => onOpenDetail(item)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </ViewTransition>
    </div>
  );
}
