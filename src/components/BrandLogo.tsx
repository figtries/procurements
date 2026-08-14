import Image from 'next/image';

export default function BrandLogo() {
  return (
    <div className="flex items-center gap-3 px-2 py-1">
      <Image
        src="/figtries.png"
        alt="Figtries"
        width={36}
        height={36}
        className="h-9 w-auto shrink-0 object-contain"
      />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold tracking-tight">Procurement</p>
        <p className="truncate text-xs text-muted-foreground">&amp; Vendor · Figtries</p>
      </div>
    </div>
  );
}
