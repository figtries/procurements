'use client';

import { useEffect, useState } from 'react';
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
  const pages = paginate(group.items);
  const [api, setApi] = useState<CarouselApi>();

  /** Coming back from an item lands on the page that item is on.
   *
   *  Returning to page one would be wrong on its own terms — you asked to go
   *  back, not to start over — and it also strands the row the detail screen
   *  morphs back into somewhere off to the side, so the card flies out of
   *  the card it lives in on its way to a row nobody can see. */
  const startIndex = Math.max(0, pages.findIndex(p => p.some(i => i.id === morphItemId)));
  const [page, setPage] = useState(startIndex);

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

  // Short groups stay a plain list: a carousel that can never move would only
  // add a dead pair of arrows to the heading.
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
    // `display: contents` leaves the carousel's own element without a box, so
    // the touch-action that keeps embla's non-passive listener off the
    // scrolling thread has nowhere to sit but the card around it. It has to
    // cover the heading too: a drag that starts there is still a drag.
    <Card className="gap-0 py-0 [touch-action:pan-y_pinch-zoom]">
      {/* The carousel takes no box of its own — `contents` lets the heading and
          the pages stay direct children of the card, so the arrows can sit up
          in the heading while still reaching the carousel's context. */}
      <Carousel
        className="contents"
        opts={{ align: 'start', watchDrag: true, startIndex }}
        setApi={setApi}
      >
        <Heading group={group} groupBy={groupBy}>
          <div className="flex shrink-0 items-center gap-1">
            <span className="tabular text-xs text-muted-foreground">
              {page + 1}/{pages.length}
            </span>
            <CarouselPrevious className="static size-7" />
            <CarouselNext className="static size-7" />
          </div>
        </Heading>
        <CarouselContent className="ml-0">
          {pages.map((pageItems, p) => (
            // The overview stacks one of these carousels per discipline, and
            // each page is five fully-drawn rows. When a swipe lifts the track
            // to its own layer, the browser would otherwise repaint every page
            // in the group into it at once — the hitch you feel as the drag
            // starts. `content-visibility` lets the pages that are off to the
            // side skip drawing until they are swiped in; the reserved size
            // keeps the card from resizing under the snap. The page the swipe
            // is on, and the one it morphs back to, are always the visible one,
            // so nothing that has to animate is ever the thing being skipped.
            <CarouselItem
              key={p}
              className="pl-0 [content-visibility:auto] [contain-intrinsic-size:auto_20rem]"
            >
              <Rows
                items={pageItems}
                groupBy={groupBy}
                morphItemId={morphItemId}
                onOpenDetail={onOpenDetail}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </Card>
  );
}
