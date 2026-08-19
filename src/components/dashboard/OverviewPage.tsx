'use client';

import {
  ViewTransition, startTransition, useEffect, useRef, useState, useTransition,
} from 'react';
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
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useMediaQuery } from '@/hooks/use-mobile';

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
  /** The row the detail screen was last opened from; the group it lives in
   *  reopens on whichever of its pages holds it. */
  lastOpenedId: string | null;
  onSearch: (v: string) => void;
  onFilterStatus: (v: string) => void;
  onFilterDisc: (v: string) => void;
  onFilterVendor: (v: string) => void;
  onClearFilters: () => void;
  onImport: () => void;
  onExport: () => void;
  onExportVendor: (vendor: string) => void;
  exporting: boolean;
  onAddItem: () => void;
  onOpenDetail: (item: ProcurementItem) => void;
}

/**
 * Groups built before the screen is handed over.
 *
 * Enough to fill the screen and not one more: what sits below the fold is
 * built a group at a time afterwards, and by the time anyone has scrolled
 * that far it has long since arrived.
 *
 * How many fill a screen is a question about the screen. Three does it on a
 * tall monitor with one to spare. A phone shows exactly one — the tiles and
 * the toolbar take the top of the page, and a group is a heading and five
 * rows two lines tall — so building three there was building two that nobody
 * could see, in the very commit the Back button was waiting on. Measured at
 * 375x812 against the same build at 1280: one width arrived with the thread
 * free, the other spent fifty to sixty-five milliseconds of it, every time.
 *
 * Split at `md`, which is where the row itself changes shape: above it a row
 * is one line with its vendor, progress and status in columns, below it two
 * with them folded onto a footer.
 */
const EAGER_GROUPS_WIDE = 3;
const EAGER_GROUPS_NARROW = 1;
const WIDE_ROWS = '(min-width: 48rem)';

/** Clearance left above the list when Show scrolls to it: the sticky bar plus
 *  a little air, so the first group heading is not welded to the rule. */
const SCROLL_CLEARANCE = 72;

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
  hasProject, lastOpenedId, onSearch, onFilterStatus, onFilterDisc, onFilterVendor,
  onClearFilters, onImport, onExport, onExportVendor, exporting, onAddItem, onOpenDetail,
}: OverviewPageProps) {
  /** Filtering runs in a transition so the list crossfades instead of snapping. */
  const [, startFilter] = useTransition();

  /** How many of the groups have been built so far.
   *
   *  A page swap cannot start until React has rendered the screen it is
   *  swapping to, so everything this page builds up front is time the Back
   *  button spends doing nothing. Measured on the way back from an item, the
   *  whole list cost between a fifth and half a second of that — the pause
   *  people read as the button being slow to respond.
   *
   *  Only the top of the page can be seen when it arrives, so only the top of
   *  it has to exist by then. The rest is built afterwards, while the swap is
   *  still animating, and lands far below the fold long before anyone can
   *  scroll to it. Each group already defers the pages of its own pager the
   *  same way.
   *
   *  A count rather than a flag, and this is the whole of the difference:
   *  built all at once, the rest of the list is one commit of some seventy
   *  rows, and React commits in a single stroke — measured, 143ms with the
   *  thread unavailable, straight after the 70ms the visible part cost. Two
   *  long tasks back to back is precisely the stutter the Back button had on
   *  a phone. Raising the count one group at a time puts each of them in a
   *  task of its own, none of them long, and the browser is free to answer a
   *  finger in between. Nothing about the total work changes; only whether it
   *  can be interrupted. */
  const wideRows = useMediaQuery(WIDE_ROWS);
  const [shownGroups, setShownGroups] = useState(
    wideRows ? EAGER_GROUPS_WIDE : EAGER_GROUPS_NARROW,
  );

  useEffect(() => {
    if (shownGroups === grouped.length) return;
    // A timer, not `requestIdleCallback`: idle callbacks are scheduled against
    // frames, so a tab that is not drawing would never build the rest of the
    // list at all. Landing in a later task is the whole point, and any timeout
    // does that. Non-urgent, so React may slice the work and keep the list it
    // just handed over responsive while the rest fills in.
    //
    // The count comes down as well as up. A filter that narrows the list to
    // two groups leaves it standing at eight, and clearing that filter would
    // then build every group again in one commit — the same long task, moved
    // from the arrival to the X on the search box. Coming down costs nothing
    // and unmounts nothing, because the groups it is counting past are groups
    // the filter has already taken off the screen.
    const id = window.setTimeout(
      () => startTransition(
        () => setShownGroups(n => (n > grouped.length ? grouped.length : n + 1)),
      ),
      0,
    );
    return () => window.clearTimeout(id);
  }, [shownGroups, grouped.length]);

  /** The list itself, and a note that the filter on it came from a banner.
   *
   *  On a wide screen the banner and the rows it narrows the list to are on
   *  screen together, so pressing Show visibly does something. On a phone the
   *  rows are several screens down past the tiles and the toolbar, and the
   *  press looks like it did nothing at all. So the list is brought to the
   *  reader rather than left for them to find. */
  const listRef = useRef<HTMLDivElement>(null);
  const scrollToList = useRef(false);

  useEffect(() => {
    if (!scrollToList.current) return;
    scrollToList.current = false;
    const el = listRef.current;
    if (!el) return;
    // A frame late on purpose: the filter is applied inside a transition, and
    // the list is only its final height once that has committed. Measured any
    // earlier, the scroll lands against the list the page used to have.
    const id = requestAnimationFrame(() => {
      const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_CLEARANCE;
      window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [filterStatus]);

  /** Narrow the list to one state, then take the reader down to it. */
  function showOnly(status: ItemStatus) {
    scrollToList.current = true;
    startFilter(() => onFilterStatus(status));
  }

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

  /** Key changes whenever a filter does, which drives the crossfade.
   *
   *  Search is deliberately not part of it. A key change snapshots the whole
   *  list and animates it, and typing changes the key on every keystroke — so
   *  one word typed into the box queued half a dozen crossfades back to back,
   *  each interrupting the last. That is the drag the filter bar has. Typing
   *  now narrows the list in place; only the pickers, one deliberate change
   *  at a time, are worth a crossfade. */
  const listKey = `${groupBy}|${filterStatus}|${filterDisc}|${filterVendor}`;

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
          {/* Two things can be exported now, so the button opens rather than
              fires. The project workbook stays first: it is the one reached
              daily, and the vendor forms are a list that grows. */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline" size="lg"
                  className="min-w-0 flex-1 sm:flex-none"
                  disabled={!total || exporting}
                />
              }
            >
              {exporting ? <Spinner /> : <ArrowUpFromLine />}
              <span className="truncate">
                {exporting ? 'Preparing…' : <>Export<span className="hidden md:inline">&nbsp;Excel</span></>}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={onExport}>
                Project workbook
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* The label belongs to the vendor list, and the menu reads that
                  from the group around them. Left loose in the popup it has no
                  group to label, and it takes the whole tab down with it. */}
              <DropdownMenuGroup>
                <DropdownMenuLabel>Vendor progress form</DropdownMenuLabel>
                <div className="max-h-64 overflow-y-auto">
                  {uniqueVendors.map(vendor => (
                    <DropdownMenuItem key={vendor} onClick={() => onExportVendor(vendor)}>
                      <span className="truncate">{vendor}</span>
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
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
        onFilterLate={() => showOnly('late')}
        onFilterRisk={() => showOnly('atrisk')}
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
            row, where every control stands 8 units tall. */}
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
              variant="ghost"
              className="col-span-2 justify-self-start text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
              onClick={() => startFilter(onClearFilters)}
            >
              <X />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* ── Item groups ── */}
      <ViewTransition key={listKey} name="item-list" share="auto" enter="auto" exit="auto" default="none">
        <div ref={listRef}>
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
              {grouped.map((group, i) => i < shownGroups && (
                <GroupCard
                  key={group.key}
                  group={group}
                  groupBy={groupBy}
                  lastOpenedId={lastOpenedId}
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
