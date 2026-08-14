import { FolderOpen } from 'lucide-react';

export default function BrandLogo() {
  return (
    <div className="flex items-center gap-3 px-2 py-1">
      {/* Same mark the active project carries in the project grid. */}
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <FolderOpen className="size-4" />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold tracking-tight">Procurement</p>
        <p className="truncate text-xs text-muted-foreground">&amp; Vendor · Figtries</p>
      </div>
    </div>
  );
}
