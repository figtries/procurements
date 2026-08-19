'use client';

import { memo, startTransition, useEffect, useMemo, useState } from 'react';
import type { GroupBy, ProcurementItem } from '@/types';
import { getDisciplineStyle } from '@/lib/procurement';
import ItemCard from './ItemCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import { ItemGroup } from '@/components/ui/item';

/** A group shows this many rows at a time; the rest arrive by swiping. */
const PAGE_SIZE = 5;

interface GroupCardProps {
  group: { key: string; label: string; items: ProcurementItem[] };
  groupBy: GroupBy;
  /** The row the detail screen was last opened from, wherever it happens to
   *  sit — the pager opens on whichever page holds it. */
  lastOpenedId?: string | null;
  /** Passed through to the rows: which of the two row arrangements to build. */
  wide?: boolean;
  onOpenDetail: (item: ProcurementItem) => void;
}

/**
 * A group heading gets a dot rather than a filled chip: six saturated pills
 * stacked down the page fight the status colours the list actually runs on.
 */
function groupAccent(groupBy: GroupBy, key: string): string {
  if (groupBy === 'discipline') return getDisciplineStyle(key).color;
  if (groupBy === 'status') return `var(--st-${key})`;
  return 'var(--muted-foreground)';
}

function paginate(items: ProcurementItem[]): ProcurementItem[][] {
  const pages: ProcurementItem[][] = [];
  for (let i = 0; i < items.length; i += PAGE_SIZE) pages.push(items.slice(i, i + PAGE_SIZE));
  return pages;
}

function Heading({ group, groupBy, children }: {
  group: GroupCardProps['group'];
  groupBy: GroupBy;
  children?: React.ReactNode;
}) {
  return (
    <CardHeader className="flex flex-row items-center gap-2.5 py-3">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ background: groupAccent(groupBy, group.key) }}
      />
      {/* Vendor names run long — the heading truncates rather than pushing
          its own count off the screen. */}
      <CardTitle className="min-w-0 truncate">{group.label}</CardTitle>
      <Badge variant="secondary" className="ml-auto shrink-0 tabular">
        {group.items.length}
        <span className="sr-only"> item{group.items.length === 1 ? '' : 's'}</span>
      </Badge>
      {children}
    </CardHeader>
  );
}

/**
 * One page of rows.
 *
 * Memoised together with the rows inside it, because the state that turns a
 * page lives just above: without this, asking for page two renders page one,
 * two and three all over again — the whole group — in the frames embla wants
 * for the slide. The pages are cut once by `paginate`, so the array handed
 * down here is the same array until the group itself changes, and every page
 * but the heading bails out.
 */
const Rows = memo(function Rows({ items, groupBy, wide, onOpenDetail }: {
  items: ProcurementItem[];
  groupBy: GroupBy;
  wide?: boolean;
  onOpenDetail: (item: ProcurementItem) => void;
}) {
  return (
    <ItemGroup className="gap-0 border-t">
      {items.map(item => (
        <ItemCard
          key={item.id}
          item={item}
          groupBy={groupBy}
          wide={wide}
          onOpen={onOpenDetail}
        />
      ))}
    </ItemGroup>
  );
});

function GroupCard({ group, groupBy, lastOpenedId, wide, onOpenDetail }: GroupCardProps) {
  const pages = useMemo(() => paginate(group.items), [group.items]);

  // Short groups stay a plain list: a pager that can never move would only add
  // a dead pair of arrows to the heading.
  if (pages.length === 1) {
    return (
      <Card className="gap-0 py-0">
        <Heading group={group} groupBy={groupBy} />
        <Rows
          items={group.items}
          groupBy={groupBy}
          wide={wide}
          onOpenDetail={onOpenDetail}
        />
      </Card>
    );
  }

  // The touch-action belongs on a real box, and the carousel inside renders
  // to `display: contents`, so the card is the one that can hold it: it keeps
  // embla's non-passive listener from riding on the vertical scroll.
  return (
    <Card className="gap-0 py-0 [touch-action:pan-y_pinch-zoom]">
      <Pager
        pages={pages}
        group={group}
        groupBy={groupBy}
        lastOpenedId={lastOpenedId}
        wide={wide}
        onOpenDetail={onOpenDetail}
      />
    </Card>
  );
}

/** Eight of these sit on the overview at once, each holding its own carousel
 *  and up to five rows a page. Whatever one of them is doing — a page turn, a
 *  warm-up timer — is its own business, and the other seven should not have to
 *  render again for it. */
export default memo(GroupCard);

/**
 * The pages of a long group, on the same carousel the discipline breakdown
 * uses on the dashboard.
 *
 * That one was already light and smooth, and it is the stock registry
 * component — so this is the app agreeing with itself rather than a second
 * carousel written by hand. What stood here before was a native scroll-snap
 * track, which sounds cheaper and is, right up until the arrows: mandatory
 * snap re-snaps every programmatic scroll the instant it lands, so the only
 * animation such a track can offer a button press is the UA's own, whose
 * duration grows with the distance it is given. A page width bought most of
 * half a second of slow ease-in-out, and that was the weight.
 */
function Pager({ pages, group, groupBy, lastOpenedId, wide, onOpenDetail }: {
  pages: ProcurementItem[][];
  group: GroupCardProps['group'];
  groupBy: GroupBy;
  lastOpenedId?: string | null;
  wide?: boolean;
  onOpenDetail: (item: ProcurementItem) => void;
}) {
  const [api, setApi] = useState<CarouselApi>();

  /** Whether the pages nobody is looking at have been built yet.
   *
   *  Returning to the overview means mounting every row of every page of
   *  every group — eighty-eight of them here, near four thousand elements —
   *  and React does that in one commit. Measured, that commit was two long
   *  tasks back to back and the better part of a second with the main thread
   *  unavailable, which is the weight the back button had.
   *
   *  Only one page of a group can be seen at a time, so only that one has to
   *  exist before the screen does. The rest arrive on the first idle moment
   *  after, long before anyone can reach for an arrow. The slide itself is
   *  never waiting on this: by the time a page can be asked for, it is
   *  already there. */
  const [warm, setWarm] = useState(false);

  /** Coming back from an item lands on the page that item is on. Returning to
   *  page one would be wrong on its own terms: you asked to go back, not to
   *  start over. Embla takes it as a starting index, so the group is already
   *  showing the right rows on the first paint rather than sliding to them. */
  const startIndex = Math.max(0, pages.findIndex(p => p.some(i => i.id === lastOpenedId)));
  const [page, setPage] = useState(startIndex);

  /** Held steady so the carousel's context is not rebuilt — and every slide
   *  in it re-rendered — on each pass through here. */
  const opts = useMemo(() => ({ align: 'start' as const, startIndex }), [startIndex]);

  useEffect(() => {
    // A timer rather than `requestIdleCallback`: idle callbacks are scheduled
    // against frames, so a tab that is not drawing never gets one and the
    // pages behind this one would never be built at all — an arrow sliding
    // into an empty box. The point here is only to land in a *second* task,
    // which any timeout does, and this one always fires.
    //
    // The empty pages hold their own width — `basis-full` does not depend on
    // what is inside them — so embla measures the same track either way.
    // Marked non-urgent so React may slice it and yield: building the pages
    // behind this one is work nobody is waiting on, and it must not be able
    // to sit on the thread while someone is already scrolling the list it
    // just handed them.
    const id = window.setTimeout(() => startTransition(() => setWarm(true)), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!api) return;
    const sync = () => setPage(api.selectedScrollSnap());
    sync();
    api.on('select', sync);
    api.on('reInit', sync);
    return () => {
      api.off('select', sync);
      api.off('reInit', sync);
    };
  }, [api]);

  return (
    // `contents` gives the carousel no box of its own, so the heading and the
    // pages stay direct children of the card and the arrows can sit up in the
    // heading while still reaching the carousel's context. The touch-action
    // has to live on a real box, which is why the card carries it: it is what
    // keeps embla's non-passive listener off the vertical scroll.
    <Carousel
      className="contents"
      opts={opts}
      setApi={setApi}
    >
      <Heading group={group} groupBy={groupBy}>
        <div className="flex shrink-0 items-center gap-1">
          <span className="tabular text-xs text-muted-foreground">
            {page + 1}/{pages.length}
          </span>
          <CarouselPrevious className="static size-7 translate-y-0" />
          <CarouselNext className="static size-7 translate-y-0" />
        </div>
      </Heading>
      <CarouselContent className="ml-0">
        {pages.map((pageItems, p) => (
          <CarouselItem key={p} className="pl-0">
            {/* Page one as well as the page being shown, always. A group's
                last page is a short one whenever its count is not a round
                multiple, so landing straight on it would give the card the
                height of one row and then grow it to five a tick later —
                a jolt on the very path this is meant to smooth. Page one is
                full by definition, so it sets the card's height from the
                first paint, and it costs a single extra row. */}
            {(warm || p === startIndex || p === 0) && (
              <Rows items={pageItems} groupBy={groupBy} wide={wide} onOpenDetail={onOpenDetail} />
            )}
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
