import type { Metadata } from 'next';
// Self-hosted so the app builds and runs without reaching a font CDN —
// site offices often have poor or filtered connectivity.
import '@fontsource-variable/inter';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

export const metadata: Metadata = {
  title: 'Procurement & Vendor · Figtries',
  description: 'Procurement and vendor management for Figtries projects.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-svh antialiased">
        <TooltipProvider delay={200}>
          {children}
          <Toaster position="bottom-center" richColors closeButton />
        </TooltipProvider>
      </body>
    </html>
  );
}
