import { ClipboardList, ListChecks, Trash2 } from 'lucide-react';
import type { ProcurementItem, Project } from '@/types';
import { computeOverallProgress, fmtDate } from '@/lib/procurement';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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

  return (
    <Card>
      <CardContent className="flex h-full flex-col">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Active project
        </p>
        <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-tight">{project.name}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {[project.client, project.location, project.pic && `PIC: ${project.pic}`]
            .filter(Boolean).join(' · ')}
          {project.contractNo && <><br />Contract: {project.contractNo}</>}
        </p>

        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-medium text-muted-foreground">Overall Progress</span>
            <span className="text-lg font-semibold tabular">{progress}%</span>
          </div>
          <Progress value={progress} trackClassName="h-2" indicatorClassName="transition-[width] duration-700" />
        </div>

        <Separator className="my-5" />

        <div className="grid grid-cols-3 gap-4 text-center">
          <Stat label="Items" value={projItems.length} />
          <Stat label="Late" value={late} warn={late > 0} />
          <Stat label="At Risk" value={atrisk} warn={atrisk > 0} />
        </div>

        {project.handover && (
          <div className="mt-5 flex items-center justify-between rounded-lg bg-muted/60 px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Handover target
            </span>
            <span className="text-sm font-semibold tabular">{fmtDate(project.handover)}</span>
          </div>
        )}

        <div className="mt-auto flex gap-2 pt-6">
          <Button className="flex-1" variant="outline" onClick={onGoOverview}>
            <ListChecks className="size-4" />
            View Overview
          </Button>
          <Button variant="destructive" onClick={onDeleteProject}>
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold tabular', warn && 'text-late-fg')}>{value}</p>
    </div>
  );
}
