import Image from 'next/image';

export default function BrandLogo() {
  return (
    <div className="flex items-center gap-3 px-2 py-1">
      {/* The app icon itself — same mark as the browser tab. */}
      <Image
        src="/app-icon.png"
        alt=""
        width={36}
        height={36}
        priority
        className="size-9 shrink-0 rounded-lg object-cover"
      />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold tracking-tight">Vendor Procurement</p>
        <p className="truncate text-xs text-muted-foreground">Figtries</p>
      </div>
    </div>
  );
}
