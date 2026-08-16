'use client';

import { useEffect } from 'react';
import { Folder, FolderOpen, LayoutDashboard, ListChecks, Plus } from 'lucide-react';
import type { PageName, ProcurementItem, Project } from '@/types';
import {
  Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem,
  CommandList, CommandSeparator,
} from '@/components/ui/command';

interface ProjectCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  items: ProcurementItem[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNavigate: (page: PageName) => void;
  onCreateProject: () => void;
}

/**
 * Jump to a project from wherever you are. The Projects page has its own
 * search box for browsing; this one is for going somewhere in two keystrokes.
 */
export default function ProjectCommand({
  open, onOpenChange, projects, items, activeProjectId,
  onSelectProject, onNavigate, onCreateProject,
}: ProjectCommandProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      onOpenChange(!open);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  /** Every command closes the palette, so the closing lives in one place. */
  function run(action: () => void) {
    onOpenChange(false);
    action();
  }

  return (
    // CommandDialog here is only the dialog shell — this registry's version
    // does not supply the cmdk root, so the <Command> has to be written out or
    // every part below it renders without a context to talk to.
    <CommandDialog open={open} onOpenChange={onOpenChange} className="sm:max-w-lg">
      <Command>
        {/* The dialog leaves focus on the body otherwise, and a palette you
            have to click into before typing is not worth the shortcut. */}
        <CommandInput autoFocus placeholder="Search projects, or jump to a page…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Projects">
            {projects.map(proj => {
              const isActive = proj.id === activeProjectId;
              const count    = items.filter(i => i.projectId === proj.id).length;
              return (
                <CommandItem
                  key={proj.id}
                  // cmdk matches on this string, so the client belongs in it —
                  // otherwise typing a client name finds nothing.
                  value={`${proj.name} ${proj.client}`}
                  onSelect={() => run(() => {
                    onSelectProject(proj.id);
                    onNavigate('dashboard');
                  })}
                >
                  {isActive ? <FolderOpen /> : <Folder />}
                  <span className="truncate">{proj.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular">
                    {isActive ? 'Active' : `${count} item${count === 1 ? '' : 's'}`}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Actions">
            <CommandItem value="dashboard" onSelect={() => run(() => onNavigate('dashboard'))}>
              <LayoutDashboard />
              Go to Dashboard
            </CommandItem>
            <CommandItem value="overview items" onSelect={() => run(() => onNavigate('overview'))}>
              <ListChecks />
              Go to Overview
            </CommandItem>
            <CommandItem value="new create project" onSelect={() => run(onCreateProject)}>
              <Plus />
              Create a new project
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
