import { ArrowRight, ClipboardList, Plus, Trash2 } from 'lucide-react';
import type { ProcurementItem, Project } from '@/types';
import { computeOverallProgress, fmtDate } from '@/lib/procurement';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from '@/components/ui/empty';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ProjectHeroProps {
  project: Project | null;
  items: ProcurementItem[];
  onGoOverview: () => void;
  onDeleteProject: () => void;
  onCreateProject: () => void;
}

export default function ProjectHero({
  project, items, onGoOverview, onDeleteProject, onCreateProject,
}: ProjectHeroProps) {
  if (!project) {
    return (
      <Empty className="rounded-xl border border-dashed py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ClipboardList />
          </EmptyMedia>
          <EmptyTitle>No project selected</EmptyTitle>
          <EmptyDescription>
            Pick one from the list below, or start a new one.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={onCreateProject}>
            <Plus />
            New project
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const projItems = items.filter(i => i.projectId === project.id);
  const progress  = computeOverallProgress(projItems);
  const late      = projItems.filter(i => i.status === 'late').length;
  const atrisk    = projItems.filter(i => i.status === 'atrisk').length;

  /* One label/value list keeps the meta block on a single rhythm. */
  const meta = [
    { label: 'Client', value: project.client },
    { label: 'Location', value: project.location },
    { label: 'PIC', value: project.pic },
    { label: 'Contract', value: project.contractNo },
    { label: 'Handover', value: project.handover ? fmtDate(project.handover) : '' },
  ].filter(f => f.value);

  return (
    // The card answers to its own width rather than the viewport's: it runs
    // the full content width here, but the sidebar can take a quarter of the
    // screen away without any breakpoint knowing about it.
    <Card className="@container">
      <CardContent>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <Badge variant="secondary" className="mb-2">Active project</Badge>
            <h2 className="text-2xl font-semibold leading-tight tracking-tight text-balance">
              {project.name}
            </h2>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onGoOverview}>
              View Overview
              <ArrowRight />
            </Button>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Delete project"
                    className="text-muted-foreground hover:border-destructive/30 hover:bg-late-bg hover:text-late-fg"
                    onClick={onDeleteProject}
                  />
                }
              >
                <Trash2 className="size-4" />
              </TooltipTrigger>
              <TooltipContent>Delete project</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Detail on the left, numbers on the right — but only once there is
            room for two columns; below that they stack in reading order. */}
        <div className="mt-6 grid gap-6 @3xl:grid-cols-[minmax(0,1fr)_22rem] @3xl:gap-10">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm @lg:grid-cols-3 @3xl:grid-cols-2 @5xl:grid-cols-3">
            {meta.map(f => (
              <div key={f.label} className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </dt>
                <dd className={cn('mt-1 truncate font-medium', f.label === 'Handover' && 'tabular')}>
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Overall progress</span>
              <span className="text-lg font-semibold tabular">{progress}%</span>
            </div>
            <Progress value={progress} trackClassName="h-2" indicatorClassName="transition-[width] duration-700" />

            <div className="mt-4 grid grid-cols-3 gap-3">
              <Stat label="Items" value={projItems.length} />
              <Stat label="Late" value={late} warn={late > 0} />
              <Stat label="At risk" value={atrisk} warn={atrisk > 0} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn('mt-0.5 text-xl font-semibold tabular', warn && 'text-late-fg')}>{value}</p>
    </div>
  );
}
