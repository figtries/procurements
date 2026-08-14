import { ClipboardList, ListChecks, Trash2 } from 'lucide-react';
import type { ProcurementItem, Project } from '@/types';
import { computeOverallProgress, fmtDate } from '@/lib/procurement';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ProjectHeroProps {
  project: Project | null;
  items: ProcurementItem[];
  onGoOverview: () => void;
  onDeleteProject: () => void;
}

export default function ProjectHero({
  project, items, onGoOverview, onDeleteProject,
}: ProjectHeroProps) {
  if (!project) {
    return (
      <Card className="justify-center py-14">
        <CardContent className="flex flex-col items-center gap-2 text-center">
          <ClipboardList className="size-8 text-muted-foreground/50" />
          <p className="text-sm font-semibold">No project selected</p>
          <p className="text-sm text-muted-foreground">Create one, or pick a project from the list below.</p>
        </CardContent>
      </Card>
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
    <Card>
      <CardContent className="flex h-full flex-col">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Active project
        </p>
        <h2 className="mt-1.5 text-2xl font-semibold leading-tight tracking-tight">
          {project.name}
        </h2>

        {/* Spacing alone separates the groups — no rules needed. */}
        <dl className="mt-5 grid grid-cols-[6rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          {meta.map(f => (
            <div key={f.label} className="contents">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className={cn('truncate font-medium', f.label === 'Handover' && 'tabular')}>
                {f.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Overall progress</span>
            <span className="text-lg font-semibold tabular">{progress}%</span>
          </div>
          <Progress value={progress} trackClassName="h-2" indicatorClassName="transition-[width] duration-700" />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat label="Items" value={projItems.length} />
          <Stat label="Late" value={late} warn={late > 0} />
          <Stat label="At risk" value={atrisk} warn={atrisk > 0} />
        </div>

        <div className="mt-auto flex gap-2 pt-6">
          <Button className="flex-1" variant="outline" onClick={onGoOverview}>
            <ListChecks className="size-4" />
            View Overview
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
