'use client';

import {
  ArrowDownToLine, ArrowUpFromLine, FolderKanban, LayoutDashboard, ListChecks,
} from 'lucide-react';
import type { PageName } from '@/types';
import BrandLogo from './BrandLogo';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface AppSidebarProps {
  page: PageName;
  attention: number;
  exporting: boolean;
  onNavigate: (page: PageName) => void;
  onImport: () => void;
  onExport: () => void;
}

const NAV = [
  { page: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { page: 'overview'  as const, label: 'Overview',  icon: ListChecks },
  { page: 'projects'  as const, label: 'Projects',  icon: FolderKanban },
];

/** Navigation rail. Rendered inside a fixed aside on desktop and a Sheet on mobile. */
export default function AppSidebar({
  page, attention, exporting, onNavigate, onImport, onExport,
}: AppSidebarProps) {
  return (
    <div className="flex h-full flex-col gap-1 p-3">
      <div className="pb-3">
        <BrandLogo />
      </div>

      <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Menu
      </p>

      {NAV.map(({ page: target, label, icon: Icon }) => {
        const active = page === target || (target === 'overview' && page === 'itemDetail');
        return (
          <Button
            key={target}
            variant={active ? 'secondary' : 'ghost'}
            className={cn('h-9 w-full justify-start gap-2.5 px-3 font-medium', !active && 'text-muted-foreground')}
            onClick={() => onNavigate(target)}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
            {target === 'overview' && attention > 0 && (
              <span className="ml-auto rounded-full bg-late-bg px-1.5 py-0.5 text-[10px] font-semibold text-late-fg tabular">
                {attention}
              </span>
            )}
          </Button>
        );
      })}

      <Separator className="my-3" />

      <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Data
      </p>

      <Button
        variant="ghost"
        className="h-9 w-full justify-start gap-2.5 px-3 font-medium text-muted-foreground"
        onClick={onImport}
      >
        <ArrowDownToLine className="size-4 shrink-0" />
        Import Excel
      </Button>
      <Button
        variant="ghost"
        className="h-9 w-full justify-start gap-2.5 px-3 font-medium text-muted-foreground"
        onClick={onExport}
        disabled={exporting}
      >
        <ArrowUpFromLine className="size-4 shrink-0" />
        {exporting ? 'Menyiapkan…' : 'Export Excel'}
      </Button>
    </div>
  );
}
