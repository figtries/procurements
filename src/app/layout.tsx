import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
