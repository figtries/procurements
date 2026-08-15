import { Folder, X } from 'lucide-react';
import type { ProcurementItem, Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ProjectGridProps {
  projects: Project[];
  items: ProcurementItem[];
  activeProjectId: string | null;
  onSelect: (id: string) => void;
  onDelete: (proj: Project) => void;
}

export default function ProjectGrid({
  projects, items, activeProjectId, onSelect, onDelete,
}: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <Card className="py-12">
        <CardContent className="flex flex-col items-center gap-2 text-center">
          <Folder className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No projects yet. Create your first one with the form above.
          </p>
        </CardContent>
      </Card>
    );
  }

  // One per row, full content width — project names are long enough that any
  // column split truncates them.
  return (
    <div className="flex flex-col gap-3">
      {projects.map(proj => {
        const isActive = activeProjectId === proj.id;
        const itemCount = items.filter(i => i.projectId === proj.id).length;

        return (
          <div
            key={proj.id}
            className={cn(
              'flex items-center gap-3 rounded-xl bg-card p-3.5 ring-1 transition-shadow duration-200 sm:gap-4 sm:p-4',
              isActive
                ? 'bg-accent shadow-sm ring-primary/40'
                : 'ring-foreground/10 hover:shadow-sm hover:ring-foreground/25',
            )}
          >
            <button
              onClick={() => onSelect(proj.id)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4"
            >
              <span className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-xl sm:size-12',
                isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}>
                <Folder className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold tracking-tight break-words sm:text-base">
                  {proj.name}
                </span>
                <span className="mt-1 block text-[13px] text-muted-foreground sm:text-sm">
                  {proj.client || 'No client'} · {itemCount} item{itemCount === 1 ? '' : 's'}
                </span>
              </span>
            </button>

            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete project ${proj.name}`}
              className="size-9 shrink-0 text-muted-foreground hover:bg-late-bg hover:text-late-fg"
              onClick={() => onDelete(proj)}
            >
              <X className="size-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
