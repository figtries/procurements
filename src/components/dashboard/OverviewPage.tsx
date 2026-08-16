'use client';

import { ViewTransition, useTransition } from 'react';
import {
  ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Clock, PackageSearch, Plus, Search,
  TriangleAlert, X,
} from 'lucide-react';
import type { GroupBy, ItemStatus, ProcurementItem } from '@/types';
import { STATUS_LABELS, computeOverallProgress } from '@/lib/procurement';
import StatTile from './StatTile';
import GroupCard from './GroupCard';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from '@/components/ui/empty';
import {
  InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput,
} from '@/components/ui/input-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface OverviewPageProps {
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
  onImport: () => void;
  onExport: () => void;
  exporting: boolean;
  onAddItem: () => void;
  onOpenDetail: (item: ProcurementItem) => void;
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
      <Alert className="border-ok/25 bg-ok-bg text-ok-fg motion-safe:animate-in motion-safe:fade-in">
        <CheckCircle2 />
        <AlertTitle>All items on track.</AlertTitle>
        <AlertDescription className="text-ok-fg/80">
          Nothing critical needs your attention.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-2.5 lg:grid-cols-2">
      {late > 0 && (
        <Alert className="border-late/25 bg-late-bg text-late-fg motion-safe:animate-in motion-safe:fade-in">
          <TriangleAlert />
          <AlertTitle>{late} item{late === 1 ? '' : 's'} overdue.</AlertTitle>
          <AlertDescription className="text-late-fg/80">
            Follow up with the vendors now.
          </AlertDescription>
          <AlertAction>
            <Button
              size="sm" variant="ghost"
              className="bg-background/70 hover:bg-background"
              onClick={onFilterLate}
            >
              Show
            </Button>
          </AlertAction>
        </Alert>
      )}
      {atrisk > 0 && (
        <Alert className="border-atrisk/30 bg-atrisk-bg text-atrisk-fg motion-safe:animate-in motion-safe:fade-in">
          <Clock />
          <AlertTitle>{atrisk} item{atrisk === 1 ? '' : 's'} at risk.</AlertTitle>
          <AlertDescription className="text-atrisk-fg/80">
            FAT falls due within the next 14 days.
          </AlertDescription>
          <AlertAction>
            <Button
              size="sm" variant="ghost"
              className="bg-background/70 hover:bg-background"
              onClick={onFilterRisk}
            >
              Show
            </Button>
          </AlertAction>
        </Alert>
      )}
    </div>
  );
}

export default function OverviewPage({
  projectItems, filteredItems, grouped, groupBy, search,
  filterStatus, filterDisc, filterVendor, hasFilters, uniqueDiscs, uniqueVendors,
  hasProject, onSearch, onFilterStatus, onFilterDisc, onFilterVendor,
  onClearFilters, onGroupBy, onImport, onExport, exporting, onAddItem, onOpenDetail,
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
    <div className="space-y-5 sm:space-y-6">
      {/* ── Page header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Overview
          </h1>
        </div>

        {/* Three separate buttons with air between them. Joined into one
            group, Import and Export shared an edge and read as a single
            cramped control — two words that long need room to be told
            apart. The word “Excel” only fits once the screen is wide. */}
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:gap-2.5">
          <Button
            variant="outline" size="lg"
            className="min-w-0 flex-1 sm:flex-none"
            onClick={onImport}
          >
            <ArrowDownToLine />
            <span className="truncate">Import<span className="hidden md:inline">&nbsp;Excel</span></span>
          </Button>
          <Button
            variant="outline" size="lg"
            className="min-w-0 flex-1 sm:flex-none"
            onClick={onExport}
            disabled={!total || exporting}
          >
            {exporting ? <Spinner /> : <ArrowUpFromLine />}
            <span className="truncate">
              {exporting ? 'Preparing…' : <>Export<span className="hidden md:inline">&nbsp;Excel</span></>}
            </span>
          </Button>
          <Button size="lg" className="min-w-0 flex-1 sm:flex-none" onClick={onAddItem}>
            <Plus />
            <span className="truncate">Add item</span>
          </Button>
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

      {/* ── Tiles ──
          Five never divide evenly into two columns, so on a phone the total
          takes the full width and the four states pair off below it. */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile
          className="col-span-2 md:col-span-1"
          label="Total items" value={total} sub={`${overallProg}% overall progress`}
        />
        <StatTile label="On Site"  value={onsite}  sub="Delivered"          tone="onsite" />
        <StatTile label="On Track" value={ontrack} sub="Progressing"        tone="ontrack" />
        <StatTile label="At Risk"  value={atrisk}  sub="FAT within 14 days" tone="atrisk" />
        <StatTile label="Late"     value={late}    sub="Overdue"            tone="late" />
      </div>

      {/* ── Toolbar ── */}
      <div className="space-y-2.5">
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={e => startFilter(() => onSearch(e.target.value))}
            placeholder="Search items…"
          />
          {search && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                className="size-7"
                aria-label="Clear search"
                onClick={() => startFilter(() => onSearch(''))}
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>

        {/* A two-column grid on a phone, so the short filters share a row on an
            exact half rather than a hand-computed width, and the long vendor
            list takes the row below. From sm up the same children flow as one
            row, where every control stands 8 units tall and therefore lines up
            with the group-by tabs at the far end. */}
        <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
          <FilterSelect
            items={statusItems}
            value={filterStatus}
            placeholder="All statuses"
            className="w-full sm:w-[10.5rem]"
            onChange={v => startFilter(() => onFilterStatus(v))}
          />
          <FilterSelect
            items={toItems(uniqueDiscs, 'All disciplines')}
            value={filterDisc}
            placeholder="All disciplines"
            className="w-full sm:w-[11rem]"
            onChange={v => startFilter(() => onFilterDisc(v))}
          />
          <FilterSelect
            items={toItems(uniqueVendors, 'All vendors')}
            value={filterVendor}
            placeholder="All vendors"
            className="col-span-2 w-full sm:w-[13rem]"
            onChange={v => startFilter(() => onFilterVendor(v))}
          />

          {hasFilters && (
            <Button
              variant="ghost" size="sm"
              className="col-span-2 justify-self-start text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
              onClick={() => startFilter(onClearFilters)}
            >
              <X />
              Clear
            </Button>
          )}

          <div className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:ml-auto">
            <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
              Group by
            </span>
            <Tabs
              className="max-sm:w-full"
              value={groupBy}
              onValueChange={v => startFilter(() => onGroupBy(v as GroupBy))}
            >
              <TabsList className="max-sm:w-full">
                <TabsTrigger value="discipline">Discipline</TabsTrigger>
                <TabsTrigger value="status">Status</TabsTrigger>
                <TabsTrigger value="vendor">Vendor</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* ── Item groups ── */}
      <ViewTransition key={listKey} name="item-list" share="auto" enter="auto" exit="auto" default="none">
        <div>
          {filteredItems.length === 0 ? (
            <Empty className="rounded-xl border border-dashed py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PackageSearch />
                </EmptyMedia>
                <EmptyTitle>{total === 0 ? 'No items yet' : 'No matching items'}</EmptyTitle>
                <EmptyDescription>
                  {total === 0
                    ? 'Add the first procurement item, or bring an existing schedule in from Excel.'
                    : 'Nothing here matches the current search and filters.'}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {total === 0 ? (
                  <div className="flex flex-wrap justify-center gap-2.5">
                    <Button variant="outline" onClick={onImport}>
                      <ArrowDownToLine />
                      Import Excel
                    </Button>
                    <Button variant="outline" onClick={onAddItem}>
                      <Plus />
                      Add item
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => startFilter(onClearFilters)}>
                    <X />
                    Clear filters
                  </Button>
                )}
              </EmptyContent>
            </Empty>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {grouped.map(group => (
                <GroupCard
                  key={group.key}
                  group={group}
                  groupBy={groupBy}
                  onOpenDetail={onOpenDetail}
                />
              ))}
            </div>
          )}
        </div>
      </ViewTransition>
    </div>
  );
}
