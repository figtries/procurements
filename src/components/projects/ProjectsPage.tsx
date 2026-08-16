'use client';

import { useMemo, useState, useTransition } from 'react';
import { Plus, Search, X } from 'lucide-react';
import type { ProcurementItem, Project } from '@/types';
import { type ProjectSummary, summariseProjects } from '@/lib/procurement';
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

interface ProjectFormState {
  name: string;
  client: string;
  location: string;
  pic: string;
  contractNo: string;
  handover: string;
}

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
  // Late work first by default: on a list of live jobs that is the order
  // anyone opening this page is actually looking for.
  const [sort, setSort]     = useState<SortKey>('attention');

  const summaries = useMemo(
    () => summariseProjects(projects, items),
    [projects, items],
  );

  const matched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter(({ project: p }) =>
      [p.name, p.client, p.location, p.pic, p.contractNo]
        .some(v => (v ?? '').toLowerCase().includes(q)));
  }, [summaries, query]);

  const visible = useMemo(
    () => [...matched].sort(COMPARATORS[sort]),
    [matched, sort],
  );

  const hasFilters = !!query.trim();

  function clearFilters() {
    startFilter(() => setQuery(''));
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Page header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Projects
          </h1>
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

        {/* Search and order, and nothing else: the health tabs asked the same
            question the sort already answers, so the row went. */}
        <div>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <InputGroup className="sm:flex-1">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={e => startFilter(() => setQuery(e.target.value))}
                placeholder="Search projects…"
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
