import { Folder } from 'lucide-react';

export default function BrandLogo() {
  return (
    <div className="flex items-center gap-3 px-2 py-1">
      {/* Same tile the saved-project rows use. */}
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Folder className="size-4" />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold tracking-tight">Vendor Procurement</p>
        <p className="truncate text-xs text-muted-foreground">Figtries</p>
      </div>
    </div>
  );
}
