'use client';

import { ArrowRight, Check, Folder, MoreHorizontal, Plus, SearchX, Trash2, X } from 'lucide-react';
import type { Project } from '@/types';
import { type ProjectSummary, fmtDate } from '@/lib/procurement';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface ProjectTableProps {
  rows: ProjectSummary[];
  /** Total before filtering, so the summary line can say what it is summing. */
  totalCount: number;
  activeProjectId: string | null;
  /** True when the list is empty only because the toolbar is filtering it. */
  filtered: boolean;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onDelete: (proj: Project) => void;
  onCreateProject: () => void;
  onClearFilters: () => void;
}

/** Dot colour per health, written out in full so Tailwind can see the classes. */
const HEALTH_DOT: Record<ProjectSummary['health'], string> = {
  attention: 'bg-late',
  ontrack:   'bg-ontrack',
  done:      'bg-onsite',
  empty:     'bg-muted-foreground/40',
};

/**
 * Handover read as a countdown. Stated plainly and never coloured: the list
 * reports where each project stands, and the urgency is raised inside the
 * project itself, where there is room to say what to do about it.
 */
function handoverHint(days: number | null): string | null {
  if (days === null) return null;
  if (days < 0)   return `${-days}d overdue`;
  if (days === 0) return 'today';
  if (days < 60)  return `in ${days}d`;
  return `in ${Math.round(days / 30)} mo`;
}

const HEAD = 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';

/** The rail that marks the active project, on whichever layout is showing. */
const ACTIVE_RAIL =
  'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary';

function Dot({ health }: { health: ProjectSummary['health'] }) {
  return <span className={cn('size-2 shrink-0 rounded-full', HEALTH_DOT[health])} />;
}

/**
 * Shared by both layouts. On a touch screen the trigger grows to 36px through
 * the coarse-pointer rules in globals.css, so it stays thumb-sized without
 * either layout asking for it.
 */
function RowMenu({ project, isActive, onSelect, onOpen, onDelete }: {
  project: Project;
  isActive: boolean;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onDelete: (proj: Project) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            aria-label={`Actions for ${project.name}`}
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onOpen(project.id)}>
          <ArrowRight />
          Open overview
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isActive} onClick={() => onSelect(project.id)}>
          <Check />
          {isActive ? 'Already active' : 'Set as active'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(project)}>
          <Trash2 />
          Delete project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ProjectTable({
  rows, totalCount, activeProjectId, filtered,
  onSelect, onOpen, onDelete, onCreateProject, onClearFilters,
}: ProjectTableProps) {
  if (rows.length === 0) {
    return (
      <Empty className="rounded-xl border border-dashed py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {filtered ? <SearchX /> : <Folder />}
          </EmptyMedia>
          <EmptyTitle>{filtered ? 'No matching projects' : 'No projects yet'}</EmptyTitle>
          <EmptyDescription>
            {filtered
              ? 'Nothing here matches the current search and filter.'
              : 'Create your first project to start tracking procurement against it.'}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {filtered ? (
            <Button variant="outline" onClick={onClearFilters}>
              <X />
              Clear filters
            </Button>
          ) : (
            <Button variant="outline" onClick={onCreateProject}>
              <Plus />
              New project
            </Button>
          )}
        </EmptyContent>
      </Empty>
    );
  }

  const totalItems = rows.reduce((s, r) => s + r.itemCount, 0);
  // Weighted by item count: a 90% project holding four items should not pull
  // the portfolio figure as hard as a 40% one holding eighty.
  const weightedProgress = totalItems
    ? Math.round(rows.reduce((s, r) => s + r.progress * r.itemCount, 0) / totalItems)
    : 0;

  const summary = `${rows.length} of ${totalCount} project${totalCount === 1 ? '' : 's'}`;

  return (
    // The card is a size container, so both layouts answer to the room the
    // card actually has rather than to the width of the window — the sidebar
    // can take 16rem of it, and a tablet in portrait is not a phone.
    <Card className="@container gap-0 overflow-hidden py-0">
      {/* ── Phone: one stacked block per project ──
          A table narrower than about 42rem can only be read by dragging it
          sideways, which is no way to look at a list on a phone. The same
          fields stack instead, and nothing is left off. */}
      <ul className="@2xl:hidden">
        {rows.map(({ project: p, itemCount, progress, health, daysToHandover }) => {
          const isActive = activeProjectId === p.id;
          const hint     = handoverHint(daysToHandover);

          return (
            <li
              key={p.id}
              className={cn(
                'relative cursor-pointer border-b transition-colors last:border-b-0 active:bg-muted/50',
                isActive && ACTIVE_RAIL,
              )}
              onClick={() => onSelect(p.id)}
            >
              <div className="flex items-start gap-2 px-4 pt-3 pb-2.5">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left outline-none focus-visible:underline focus-visible:underline-offset-4"
                  onClick={e => { e.stopPropagation(); onSelect(p.id); }}
                >
                  <span className="flex items-center gap-2">
                    <Dot health={health} />
                    <span className="truncate font-medium">{p.name}</span>
                    {isActive && <Badge variant="outline" className="shrink-0">Active</Badge>}
                  </span>
                  <span className="mt-1 block truncate pl-4 text-[13px] text-muted-foreground">
                    {p.client || 'No client'}
                    {p.location && ` · ${p.location}`}
                  </span>
                  <span className="mt-0.5 block truncate pl-4 text-xs text-muted-foreground tabular">
                    {itemCount} item{itemCount === 1 ? '' : 's'}
                    {p.contractNo && ` · ${p.contractNo}`}
                    {p.handover && ` · ${fmtDate(p.handover)}`}
                    {hint && ` · ${hint}`}
                  </span>
                </button>

                <div
                  className="flex shrink-0 items-center gap-1"
                  onClick={e => e.stopPropagation()}
                >
                  <span className="text-sm font-medium tabular">{progress}%</span>
                  <RowMenu
                    project={p}
                    isActive={isActive}
                    onSelect={onSelect}
                    onOpen={onOpen}
                    onDelete={onDelete}
                  />
                </div>
              </div>

              <Progress
                value={progress}
                className="px-4 pb-3"
                trackClassName="h-1 bg-foreground/10"
                indicatorClassName="transition-[width] duration-700"
              />
            </li>
          );
        })}

        {/* No totals strip down here. On the table below, the same figures land
            under the columns they are totalling; stacked, there are no columns
            for them to land under, so the line read as a stray caption glued to
            the bottom of the last project. */}
      </ul>

      {/* ── Tablet and desktop: one row per project ──
          A row is one project across a shared set of columns, so the eye can
          run down a single field — every handover date, every contract number
          — the way it never could across a wall of cards. */}
      <div className="hidden @2xl:block">
        <Table className="[&_td]:px-3 [&_th]:px-3 [&_td:first-child]:pl-4 [&_th:first-child]:pl-4 [&_td:last-child]:pr-3 [&_th:last-child]:pr-3">
          {/* No tinted bands anywhere — the card is one white surface and the
              rules between rows carry the structure on their own. */}
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={HEAD}>Project</TableHead>
              {/* Each column waits until the card can hold everything to its
                  left plus itself. Turned on any earlier, the table runs past
                  the card and pushes the row menu off the right-hand edge. */}
              <TableHead className={cn(HEAD, 'hidden @2xl:table-cell')}>Client</TableHead>
              <TableHead className={cn(HEAD, 'hidden @6xl:table-cell')}>Location</TableHead>
              <TableHead className={cn(HEAD, 'hidden @5xl:table-cell')}>Contract No</TableHead>
              <TableHead className={cn(HEAD, 'hidden @4xl:table-cell')}>Handover</TableHead>
              <TableHead className={cn(HEAD, 'text-right')}>Items</TableHead>
              <TableHead className={cn(HEAD, 'w-[8.75rem] text-right')}>Progress</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map(({ project: p, itemCount, progress, health, daysToHandover }) => {
              const isActive = activeProjectId === p.id;
              const hint     = handoverHint(daysToHandover);

              return (
                <TableRow
                  key={p.id}
                  data-state={isActive ? 'selected' : undefined}
                  className="cursor-pointer data-[state=selected]:bg-transparent"
                  onClick={() => onSelect(p.id)}
                >
                  {/* The active project is marked by a rail and a chip, not by
                      a filled row — one tinted band would be the loudest thing
                      on an otherwise white table. */}
                  <TableCell className={cn('relative py-3', isActive && ACTIVE_RAIL)}>
                    <button
                      type="button"
                      className="flex max-w-[13rem] items-center gap-2 text-left outline-none @4xl:max-w-[16rem] focus-visible:underline focus-visible:underline-offset-4"
                      onClick={e => { e.stopPropagation(); onSelect(p.id); }}
                    >
                      <Dot health={health} />
                      <span className="truncate font-medium">{p.name}</span>
                      {isActive && <Badge variant="outline" className="shrink-0">Active</Badge>}
                    </button>
                  </TableCell>

                  {/* The caps are what make the column ladder safe: without a
                      ceiling on each field, one long client name could push
                      the table past the card whichever columns are showing. */}
                  <TableCell className="hidden py-3 @2xl:table-cell">
                    <span className="block max-w-[9rem] truncate">
                      {p.client || <span className="text-muted-foreground">—</span>}
                    </span>
                  </TableCell>

                  <TableCell className="hidden py-3 @6xl:table-cell">
                    <span className="block max-w-[8rem] truncate">{p.location || '—'}</span>
                  </TableCell>

                  <TableCell className="hidden py-3 @5xl:table-cell">
                    <span className="block max-w-[8rem] truncate tabular">
                      {p.contractNo || '—'}
                    </span>
                  </TableCell>

                  <TableCell className="hidden py-3 tabular @4xl:table-cell">
                    {p.handover ? (
                      <>
                        {fmtDate(p.handover)}
                        {/* Gives its space back when the card is narrow — the
                            date on its own already carries the column. */}
                        {hint && (
                          <span className="ml-1.5 hidden text-muted-foreground @7xl:inline">
                            · {hint}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* A plain count. How many of them are late is a question the
                      project answers once you are inside it. */}
                  <TableCell className="py-3 text-right tabular">{itemCount}</TableCell>

                  {/* Rail and number travel together at a fixed width, hard
                      against the right edge. Left to stretch, the two drifted
                      apart and the column read as two unrelated things. */}
                  <TableCell className="py-3">
                    <div className="flex items-center justify-end gap-2.5">
                      <Progress
                        value={progress}
                        className="w-16 shrink-0"
                        trackClassName="h-1.5 bg-foreground/10"
                        indicatorClassName="transition-[width] duration-700"
                      />
                      <span className="w-10 shrink-0 text-right font-medium tabular">
                        {progress}%
                      </span>
                    </div>
                  </TableCell>

                  {/* Padded tighter than its neighbours on purpose: the button
                      is taller than a line of text, and at py-3 it alone was
                      setting the height of every row. */}
                  <TableCell className="py-1.5" onClick={e => e.stopPropagation()}>
                    <RowMenu
                      project={p}
                      isActive={isActive}
                      onSelect={onSelect}
                      onOpen={onOpen}
                      onDelete={onDelete}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>

          {/* Worth a line of its own: the portfolio totals are the first thing
              asked for in a progress meeting, and nobody should add them up by eye. */}
          {rows.length > 1 && (
            <TableFooter className="bg-transparent">
              {/* Every column is written out rather than spanned: the middle
                  ones drop away at narrow widths, and a colSpan would keep
                  counting cells the row no longer has. */}
              <TableRow className="hover:bg-transparent">
                <TableCell className="py-2.5 text-xs font-normal text-muted-foreground">
                  {summary}
                </TableCell>
                <TableCell className="hidden @2xl:table-cell" />
                <TableCell className="hidden @6xl:table-cell" />
                <TableCell className="hidden @5xl:table-cell" />
                <TableCell className="hidden @4xl:table-cell" />
                <TableCell className="py-2.5 text-right tabular">{totalItems}</TableCell>
                {/* No label needed — the figure sits in the progress column,
                    and a word floating beside it only cluttered the line. */}
                <TableCell className="py-2.5 text-right tabular">{weightedProgress}%</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </Card>
  );
}
