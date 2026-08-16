'use client';

import { useMemo, useState, useTransition } from 'react';
import { Plus, Search, X } from 'lucide-react';
import type { ProcurementItem, Project } from '@/types';
import {
  type ProjectHealth, type ProjectSummary, summariseProjects,
} from '@/lib/procurement';
import ProjectHero from './ProjectHero';
import ProjectForm from './ProjectForm';
import ProjectTable from './ProjectTable';
import { Button } from '@/components/ui/button';
import {
  InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput,
} from '@/components/ui/input-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ProjectFormState {
  name: string;
  client: string;
  location: string;
  pic: string;
  contractNo: string;
  handover: string;
}

/** Filters are named after the question being asked, not after a data field. */
type HealthFilter = 'all' | ProjectHealth;

/**
 * A project with nothing in it yet has no shortlist of its own — it turns up
 * under All like everything else. Filtering to a set that can only ever be
 * empty of work was one tab too many.
 */
const HEALTH_TABS: Array<{ value: HealthFilter; label: string }> = [
  { value: 'all',       label: 'All' },
  { value: 'attention', label: 'Needs attention' },
  { value: 'ontrack',   label: 'On track' },
  { value: 'done',      label: 'Delivered' },
];

type SortKey = 'attention' | 'handover' | 'progress' | 'recent' | 'name';

const SORT_ITEMS: Array<{ value: SortKey; label: string }> = [
  { value: 'attention', label: 'Needs attention first' },
  { value: 'handover',  label: 'Handover soonest' },
  { value: 'progress',  label: 'Least progress first' },
  { value: 'recent',    label: 'Newest first' },
  { value: 'name',      label: 'Name (A–Z)' },
];

/** Projects with no handover date sink to the bottom rather than lead the list. */
function byHandover(a: ProjectSummary, b: ProjectSummary): number {
  if (a.daysToHandover === null) return b.daysToHandover === null ? 0 : 1;
  if (b.daysToHandover === null) return -1;
  return a.daysToHandover - b.daysToHandover;
}

const COMPARATORS: Record<SortKey, (a: ProjectSummary, b: ProjectSummary) => number> = {
  attention: (a, b) => b.late - a.late || b.atrisk - a.atrisk || byHandover(a, b),
  handover:  byHandover,
  progress:  (a, b) => a.progress - b.progress,
  name:      (a, b) => a.project.name.localeCompare(b.project.name),
  // Newest first, and anything without a timestamp sinks to the bottom rather
  // than jumping to the top on an empty-string compare.
  recent:    (a, b) => (b.project.createdAt ?? '').localeCompare(a.project.createdAt ?? ''),
};

interface ProjectsPageProps {
  projects: Project[];
  items: ProcurementItem[];
  activeProject: Project | null;
  activeProjectId: string | null;
  form: ProjectFormState;
  formOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
  onFormChange: (field: string, value: string) => void;
  onCreateProject: () => void;
  onSelectProject: (id: string) => void;
  onOpenProject: (id: string) => void;
  onDeleteProject: (proj: Project) => void;
  onGoOverview: () => void;
  onDeleteActiveProject: () => void;
}

export default function ProjectsPage({
  projects, items, activeProject, activeProjectId, form, formOpen,
  onFormOpenChange, onFormChange, onCreateProject, onSelectProject, onOpenProject,
  onDeleteProject, onGoOverview, onDeleteActiveProject,
}: ProjectsPageProps) {
  /** Filtering runs in a transition so the table crossfades instead of snapping. */
  const [, startFilter] = useTransition();
  const [query, setQuery]   = useState('');
  const [health, setHealth] = useState<HealthFilter>('all');
  // Late work first by default: on a list of live jobs that is the order
  // anyone opening this page is actually looking for.
  const [sort, setSort]     = useState<SortKey>('attention');

  const summaries = useMemo(
    () => summariseProjects(projects, items),
    [projects, items],
  );

  /** Search runs first, so the tab counts only ever promise rows that exist. */
  const matched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter(({ project: p }) =>
      [p.name, p.client, p.location, p.pic, p.contractNo]
        .some(v => (v ?? '').toLowerCase().includes(q)));
  }, [summaries, query]);

  const counts = useMemo(() => {
    const out: Record<HealthFilter, number> = {
      all: matched.length, attention: 0, ontrack: 0, done: 0, empty: 0,
    };
    for (const row of matched) out[row.health]++;
    return out;
  }, [matched]);

  const visible = useMemo(() => {
    const rows = health === 'all' ? matched : matched.filter(r => r.health === health);
    return [...rows].sort(COMPARATORS[sort]);
  }, [matched, health, sort]);

  const hasFilters = !!query.trim() || health !== 'all';

  function clearFilters() {
    startFilter(() => { setQuery(''); setHealth('all'); });
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Page header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Projects
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {projects.length} project{projects.length === 1 ? '' : 's'} · pick one to make it active
          </p>
        </div>

        <Button size="lg" className="shrink-0 max-sm:w-full" onClick={() => onFormOpenChange(true)}>
          <Plus />
          New project
        </Button>
      </div>

      <ProjectHero
        project={activeProject}
        items={items}
        onGoOverview={onGoOverview}
        onDeleteProject={onDeleteActiveProject}
        onCreateProject={() => onFormOpenChange(true)}
      />

      {/* ── All projects ── */}
      <div className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:sr-only">
          All projects
        </h2>

        {/* Search and order on one line, then the shortlist tabs below them —
            two decisions rather than a row of dropdowns that all look alike. */}
        <div className="space-y-2.5">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <InputGroup className="sm:flex-1">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={e => startFilter(() => setQuery(e.target.value))}
                placeholder="Search name, client, location, contract no or PIC…"
              />
              {query && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    className="size-7"
                    aria-label="Clear search"
                    onClick={() => startFilter(() => setQuery(''))}
                  >
                    <X />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>

            <Select
              items={SORT_ITEMS}
              value={sort}
              onValueChange={v => startFilter(() => setSort(v as SortKey))}
            >
              <SelectTrigger className="w-full sm:w-[13rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_ITEMS.map(item => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-2">
            {/* Five labels do not fit one line on a phone, so they wrap onto a
                second row. Nothing here scrolls sideways: a filter you have to
                go looking for by dragging is a filter nobody finds. */}
            <Tabs
              className="min-w-0 flex-1 sm:flex-none"
              value={health}
              onValueChange={v => startFilter(() => setHealth(v as HealthFilter))}
            >
              {/* The height is forced: TabsList pins itself to h-8 through a
                  group variant, which a plain `h-auto` sits alongside rather
                  than replaces — and a fixed height would leave the second row
                  hanging outside the box it belongs to. */}
              <TabsList className="w-full flex-wrap justify-start gap-0.5 max-sm:h-auto! sm:w-fit sm:flex-nowrap sm:gap-0">
                {HEALTH_TABS.map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="h-7 flex-none px-2.5 sm:h-[calc(100%-1px)]"
                  >
                    {tab.label}
                    <span className="tabular text-xs opacity-60">{counts[tab.value]}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {hasFilters && (
              <Button
                variant="ghost" size="sm"
                className="ml-auto shrink-0 text-muted-foreground motion-safe:animate-in motion-safe:fade-in"
                onClick={clearFilters}
              >
                <X />
                Clear
              </Button>
            )}
          </div>
        </div>

        <ProjectTable
          rows={visible}
          totalCount={projects.length}
          activeProjectId={activeProjectId}
          filtered={hasFilters}
          onSelect={onSelectProject}
          onOpen={onOpenProject}
          onDelete={onDeleteProject}
          onCreateProject={() => onFormOpenChange(true)}
          onClearFilters={clearFilters}
        />
      </div>

      <ProjectForm
        open={formOpen}
        onOpenChange={onFormOpenChange}
        name={form.name}
        client={form.client}
        location={form.location}
        pic={form.pic}
        contractNo={form.contractNo}
        handover={form.handover}
        onChange={onFormChange}
        onSubmit={onCreateProject}
      />
    </div>
  );
}
