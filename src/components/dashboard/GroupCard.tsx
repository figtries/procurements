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

function Rows({ items, groupBy, onOpenDetail }: {
  items: ProcurementItem[];
  groupBy: GroupBy;
  onOpenDetail: (item: ProcurementItem) => void;
}) {
  return (
    <ItemGroup className="gap-0 border-t">
      {items.map((item, i) => (
        <ItemCard
          key={item.id}
          item={item}
          index={i}
          groupBy={groupBy}
          onClick={() => onOpenDetail(item)}
        />
      ))}
    </ItemGroup>
  );
}

export default function GroupCard({ group, groupBy, onOpenDetail }: GroupCardProps) {
  const pages = paginate(group.items);
  const [api, setApi] = useState<CarouselApi>();
  const [page, setPage] = useState(0);

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
        <Rows items={group.items} groupBy={groupBy} onOpenDetail={onOpenDetail} />
      </Card>
    );
  }

  return (
    <Card className="gap-0 py-0">
      {/* The carousel takes no box of its own — `contents` lets the heading and
          the pages stay direct children of the card, so the arrows can sit up
          in the heading while still reaching the carousel's context. */}
      <Carousel
        className="contents"
        opts={{ align: 'start', watchDrag: true }}
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
            <CarouselItem key={p} className="pl-0">
              <Rows items={pageItems} groupBy={groupBy} onOpenDetail={onOpenDetail} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </Card>
  );
}
