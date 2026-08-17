'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { GroupBy, ProcurementItem } from '@/types';
import { getDisciplineStyle } from '@/lib/procurement';
import ItemCard from './ItemCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ItemGroup } from '@/components/ui/item';

/** A group shows this many rows at a time; the rest arrive by swiping. */
const PAGE_SIZE = 5;

interface GroupCardProps {
  group: { key: string; label: string; items: ProcurementItem[] };
  groupBy: GroupBy;
  /** The row the detail screen was last opened from, wherever it happens to
   *  sit — it is the one that morphs into that screen and back. */
  morphItemId?: string | null;
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

function Rows({ items, groupBy, morphItemId, onOpenDetail }: {
  items: ProcurementItem[];
  groupBy: GroupBy;
  morphItemId?: string | null;
  onOpenDetail: (item: ProcurementItem) => void;
}) {
  return (
    <ItemGroup className="gap-0 border-t">
      {items.map(item => (
        <ItemCard
          key={item.id}
          item={item}
          groupBy={groupBy}
          morph={item.id === morphItemId}
          onClick={() => onOpenDetail(item)}
        />
      ))}
    </ItemGroup>
  );
}

export default function GroupCard({ group, groupBy, morphItemId, onOpenDetail }: GroupCardProps) {
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
          morphItemId={morphItemId}
          onOpenDetail={onOpenDetail}
        />
      </Card>
    );
  }

  return (
    <Card className="gap-0 py-0">
      <Pager
        pages={pages}
        group={group}
        groupBy={groupBy}
        morphItemId={morphItemId}
        onOpenDetail={onOpenDetail}
      />
    </Card>
  );
}

/**
 * The pages ride a native scroll-snap track.
 *
 * A JS carousel has to claim the horizontal gesture from the browser, which
 * means every frame of a drag is main-thread work: the finger moves only as
 * fast as React is free to answer it. A desktop CPU hides that — the rows
 * there are even heavier, with three extra columns per row — but a phone
 * cannot, which is why the swipe dragged on a phone and nowhere else.
 *
 * Handing the gesture back to the browser moves it to the compositor: the
 * track follows the finger and keeps its momentum whatever the main thread is
 * doing. The card can then afford its ordinary paint cost, so there is no need
 * to hold a layer open or to stop the off-screen pages drawing.
 */
function Pager({ pages, group, groupBy, morphItemId, onOpenDetail }: {
  pages: ProcurementItem[][];
  group: GroupCardProps['group'];
  groupBy: GroupBy;
  morphItemId?: string | null;
  onOpenDetail: (item: ProcurementItem) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  /** Coming back from an item lands on the page that item is on.
   *
   *  Returning to page one would be wrong on its own terms — you asked to go
   *  back, not to start over — and it also strands the row the detail screen
   *  morphs back into somewhere off to the side, so the card flies out of the
   *  card it lives in on its way to a row nobody can see. */
  const startIndex = Math.max(0, pages.findIndex(p => p.some(i => i.id === morphItemId)));
  const [page, setPage] = useState(startIndex);

  // Take the starting page before the first paint, so the morph lands on a
  // page already in view rather than scrolling there afterwards. Mount only:
  // once the track is up, where it sits is the reader's business.
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (el) el.scrollLeft = startIndex * el.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The heading counter reads the track's own scroll offset, coalesced to one
  // read a frame. The listener is passive and the arithmetic is a division, so
  // it cannot hold up a scroll the compositor is already running; and asking
  // for the page we are on is a no-op in React until that page changes, so a
  // swipe re-renders the heading once rather than once a frame.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      if (el.clientWidth) setPage(Math.round(el.scrollLeft / el.clientWidth));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const goTo = (next: number) => {
    const el = trackRef.current;
    if (el) el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <>
      <Heading group={group} groupBy={groupBy}>
        <div className="flex shrink-0 items-center gap-1">
          <span className="tabular text-xs text-muted-foreground">
            {page + 1}/{pages.length}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            className="size-7 touch-manipulation rounded-full"
            disabled={page === 0}
            onClick={() => goTo(page - 1)}
          >
            <ChevronLeftIcon />
            <span className="sr-only">Previous page</span>
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="size-7 touch-manipulation rounded-full"
            disabled={page === pages.length - 1}
            onClick={() => goTo(page + 1)}
          >
            <ChevronRightIcon />
            <span className="sr-only">Next page</span>
          </Button>
        </div>
      </Heading>
      {/* `overscroll-x-contain` keeps a swipe that runs out of pages from
          carrying on into the browser's own back gesture. */}
      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${group.label} items`}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {pages.map((pageItems, p) => (
          <div
            key={p}
            role="group"
            aria-roledescription="slide"
            className="min-w-0 shrink-0 grow-0 basis-full snap-start snap-always"
          >
            <Rows
              items={pageItems}
              groupBy={groupBy}
              morphItemId={morphItemId}
              onOpenDetail={onOpenDetail}
            />
          </div>
        ))}
      </div>
    </>
  );
}
