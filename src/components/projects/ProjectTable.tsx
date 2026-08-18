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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface ProjectTableProps {
  rows: ProjectSummary[];
  activeProjectId: string | null;
  /** True when the list is empty only because the toolbar is filtering it. */
  filtered: boolean;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onDelete: (proj: Project) => void;
  onCreateProject: () => void;
  onClearFilters: () => void;
}

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
  rows, activeProjectId, filtered,
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

  return (
    // The card is a size container, so both layouts answer to the room the
    // card actually has rather than to the width of the window — the sidebar
    // can take 16rem of it, and a tablet in portrait is not a phone.
    <Card className="@container gap-0 overflow-hidden py-0">
      {/* ── Phone: name and client, one project per line ──
          A table narrower than about 42rem can only be read by dragging it
          sideways, which is no way to look at a list on a phone. Carrying
          every column down into a stack was no better: eight fields per
          project turned the list into a wall. So the phone keeps only what it
          takes to pick a project out — its name and whose it is — and the
          rest waits for the width the table needs anyway.

          The row menu goes with them. Its actions all live elsewhere on a
          phone: tapping the row makes the project active, and the hero above
          this list opens and deletes whichever project that is. Keeping the
          trigger only cost the name the width it was truncating against.

          Which project is active is said by the rail alone here — a chip
          beside the name was one more thing crowding the same line.

          No rules between the rows on either layout; the space between them
          is what separates one project from the next. */}
      <ul className="@2xl:hidden">
        {rows.map(({ project: p, progress }) => {
          const isActive = activeProjectId === p.id;

          return (
            <li
              key={p.id}
              className={cn(
                'relative transition-colors active:bg-muted/50',
                isActive && ACTIVE_RAIL,
              )}
            >
              {/* One button, the whole row. The only thing beside the name is
                  the percentage, at a fixed width against the right edge: four
                  characters at their widest, so the name is truncated by the
                  card rather than by whatever this row happens to say. Down
                  the list the digits line up into a column, which is the point
                  — it is read by scanning the edge, not row by row. */}
              <button
                type="button"
                className="flex w-full items-baseline gap-3 px-4 py-3.5 text-left outline-none focus-visible:underline focus-visible:underline-offset-4"
                onClick={() => onSelect(p.id)}
              >
                <span className="min-w-0 flex-1">
                  {/* A size larger than the table sets on the other layout.
                      A row here holds two lines where a table row holds eight
                      columns, so the type can take the room the phone has
                      instead of being sized by a grid that is not showing. */}
                  <span className="block truncate text-base font-medium">{p.name}</span>
                  <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                    {p.client || 'No client'}
                  </span>
                </span>
                <span className="w-12 shrink-0 text-right text-base font-medium tabular">
                  {progress}%
                </span>
              </button>
            </li>
          );
        })}

        {/* The list ends with the last project, on both layouts. A totals row
            used to close it off — a count of projects and the weighted
            portfolio progress — but it answered a question this page is not
            for. This page is for finding a project and opening it; how the
            portfolio is doing is what the dashboard is. */}
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
            {rows.map(({ project: p, itemCount, progress, daysToHandover }) => {
              const isActive = activeProjectId === p.id;
              const hint     = handoverHint(daysToHandover);

              return (
                <TableRow
                  key={p.id}
                  data-state={isActive ? 'selected' : undefined}
                  className="cursor-pointer border-b-0 data-[state=selected]:bg-transparent"
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
        </Table>
      </div>
    </Card>
  );
}
