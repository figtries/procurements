'use client';

import { useRef, useState } from 'react';
import { FileSpreadsheet, TriangleAlert, Upload } from 'lucide-react';
import type { ImportResult, ImportedRow, ProcurementItem } from '@/types';
import { importWorkbook } from '@/lib/excelImport';
import { DISCIPLINES, fmtDate } from '@/lib/procurement';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface ImportModalProps {
  open: boolean;
  existingItems: ProcurementItem[];
  onClose: () => void;
  onConfirm: (rows: ImportedRow[]) => void;
}

export default function ImportModal({
  open, existingItems, onClose, onConfirm,
}: ImportModalProps) {
  const [result, setResult]     = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [reading, setReading]   = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setResult(null);
    setFileName('');
    setReading(false);
    setDragging(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => { reset(); onClose(); };

  async function readFile(file: File) {
    setReading(true);
    setFileName(file.name);
    // Parsing a workbook blocks the main thread, so give the browser a beat to
    // paint the loading state first — otherwise the UI just freezes with no
    // feedback. A timer rather than rAF: rAF never fires in a hidden tab, which
    // would leave the import stuck if the user switched away.
    await new Promise(resolve => setTimeout(resolve, 32));
    try {
      setResult(await importWorkbook(file, existingItems));
    } catch (err) {
      setResult({ rows: [], sheetsRead: [], errors: [`Could not read the file: ${(err as Error).message}`] });
    } finally {
      setReading(false);
    }
  }

  const updateRow = (index: number, patch: Partial<ImportedRow>) => {
    setResult(prev => prev && {
      ...prev,
      rows: prev.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    });
  };

  const rows            = result?.rows ?? [];
  const selected        = rows.filter(r => r.include);
  const willUpdate      = selected.filter(r => r.matchesItemId).length;
  const willInsert      = selected.length - willUpdate;
  const duplicates      = rows.filter(r => r.duplicateOf !== undefined).length;
  const needsDiscipline = selected.filter(r => !r.discipline).length;

  const setAll = (include: boolean) => {
    setResult(prev => prev && {
      ...prev,
      // Leave detected duplicates unticked when selecting everything.
      rows: prev.rows.map(r => ({ ...r, include: include && r.duplicateOf === undefined })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) close(); }}>
      <DialogContent className="flex max-h-[92svh] flex-col gap-0 overflow-hidden p-0 sm:max-h-[90svh] sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b p-4">
          <DialogTitle>Import from Excel</DialogTitle>
          <DialogDescription>
            Every sheet is read, header rows are detected, and disciplines are split out of
            section rows such as “A. ELECTRICAL”.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {/* ── Drop zone ── */}
          {!result && !reading && (
            <button
              type="button"
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) readFile(file);
              }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'group flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-14',
                'transition-colors duration-200',
                dragging ? 'border-primary bg-accent' : 'bg-muted/40 hover:border-primary/50',
              )}
            >
              <Upload className="size-8 text-muted-foreground/60 transition-transform duration-200 group-hover:-translate-y-0.5" />
              <span className="text-base font-medium">Drop an Excel file here</span>
              <span className="text-sm text-muted-foreground">
                or click to browse · .xlsx format
              </span>
            </button>
          )}

          {/* Parsing a large workbook blocks for a few seconds, so show the
              shape of the table that is coming rather than a bare spinner. */}
          {reading && (
            <div className="animate-in fade-in space-y-3">
              <div className="flex items-center gap-2.5 rounded-xl bg-muted/60 px-4 py-3">
                <FileSpreadsheet className="size-4 shrink-0 animate-pulse text-muted-foreground" />
                <span className="truncate text-sm font-medium">{fileName}</span>
                <span className="ml-auto text-xs text-muted-foreground">Reading file…</span>
              </div>
              <div className="space-y-2 rounded-xl border p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-4 rounded" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Large files can take a few seconds.
              </p>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) readFile(file);
            }}
          />

          {/* ── Errors ── */}
          {result?.errors.map(err => (
            <div
              key={err}
              className="mb-3 flex items-start gap-2.5 rounded-lg border border-late/20 bg-late-bg px-3.5 py-2.5 text-sm text-late-fg"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{err}</span>
            </div>
          ))}

          {/* ── Preview ── */}
          {result && rows.length > 0 && (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-muted/60 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{fileName}</span>
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={reset}>
                    Change file
                  </Button>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span><b className="text-foreground tabular">{rows.length}</b> rows read</span>
                  <span>
                    <b className="text-foreground tabular">{result.sheetsRead.length}</b> sheet{result.sheetsRead.length === 1 ? '' : 's'}:{' '}
                    {result.sheetsRead.join(', ')}
                  </span>
                  {duplicates > 0 && (
                    <span className="text-atrisk-fg">
                      <b className="tabular">{duplicates}</b> duplicates
                    </span>
                  )}
                </div>
              </div>

              {needsDiscipline > 0 && (
                <div className="mb-3 rounded-lg border border-atrisk/25 bg-atrisk-bg px-3.5 py-2.5 text-sm text-atrisk-fg">
                  {needsDiscipline} rows have no discipline yet. Set one in the Discipline column before importing.
                </div>
              )}

              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  <b className="text-foreground tabular">{selected.length}</b> selected — {willInsert} new
                  {willUpdate > 0 && `, ${willUpdate} updating existing items`}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAll(true)}>Select all</Button>
                  <Button variant="outline" size="sm" onClick={() => setAll(false)}>Clear</Button>
                </div>
              </div>

              {/* Only the three columns a reviewer has to act on survive to a
                  phone; the rest come back once there is room for them. */}
              <div className="max-h-[50svh] overflow-auto rounded-xl border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-muted">
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead className="min-w-36 md:min-w-48">Equipment</TableHead>
                      <TableHead className="w-36">Discipline</TableHead>
                      <TableHead className="hidden min-w-32 sm:table-cell">Vendor</TableHead>
                      <TableHead className="hidden w-28 sm:table-cell">PO No</TableHead>
                      <TableHead className="hidden w-16 text-center lg:table-cell">Rdns</TableHead>
                      <TableHead className="hidden w-28 md:table-cell">FAT</TableHead>
                      <TableHead className="hidden w-28 md:table-cell">Delivery</TableHead>
                      <TableHead className="hidden min-w-40 lg:table-cell">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, i) => {
                      const isDup   = row.duplicateOf !== undefined;
                      const fatDate = row.fat.actual || row.fat.plan;
                      const mosDate = row.mos.actual || row.mos.forecast || row.mos.plan;
                      return (
                        <TableRow
                          key={`${row.sourceSheet}-${row.sourceRow}`}
                          style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
                          className={cn(
                            'align-top transition-colors',
                            'motion-safe:animate-in motion-safe:fade-in motion-safe:fill-mode-backwards',
                            isDup && 'bg-atrisk-bg',
                            row.matchesItemId && 'bg-info-bg',
                            !row.include && 'opacity-50',
                          )}
                        >
                          <TableCell>
                            <Checkbox
                              checked={row.include}
                              onCheckedChange={v => updateRow(i, { include: v === true })}
                              aria-label={`Include ${row.desc}`}
                            />
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            <p className="font-medium leading-snug">{row.desc}</p>
                            {/* Vendor and PO have their own columns from sm up;
                                on a phone they ride along under the name. */}
                            <p className="mt-1 truncate text-[10.5px] text-muted-foreground sm:hidden">
                              {row.vendor || '—'}{row.poNo ? ` · ${row.poNo}` : ''}
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground">
                              {row.sourceSheet} · row {row.sourceRow}
                              {row.matchesItemId && (
                                <Badge
                                  variant="secondary"
                                  className="border-transparent bg-info-bg px-1.5 py-0 text-[9px] text-info-fg"
                                >
                                  updating
                                </Badge>
                              )}
                              {isDup && (
                                <Badge
                                  variant="secondary"
                                  className="border-transparent bg-atrisk-bg px-1.5 py-0 text-[9px] text-atrisk-fg"
                                >
                                  duplicate
                                </Badge>
                              )}
                            </p>
                            {row.warnings.map(w => (
                              <p key={w} className="mt-1 text-[10.5px] leading-snug text-atrisk-fg">{w}</p>
                            ))}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={row.discipline || undefined}
                              onValueChange={v => updateRow(i, { discipline: v ?? '' })}
                            >
                              <SelectTrigger size="sm" className="w-full">
                                <SelectValue placeholder="— pick —" />
                              </SelectTrigger>
                              <SelectContent>
                                {DISCIPLINES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="hidden text-xs sm:table-cell">{row.vendor || '—'}</TableCell>
                          <TableCell className="hidden whitespace-nowrap text-xs tabular sm:table-cell">
                            {row.poNo || '—'}
                          </TableCell>
                          <TableCell className="hidden text-center text-xs tabular lg:table-cell">
                            {row.readinessDoc ? `${Math.round(row.readinessDoc * 100)}%` : '—'}
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap text-xs tabular md:table-cell">
                            {fatDate ? fmtDate(fatDate) : '—'}
                            {row.fat.actual && <span className="ml-1 font-bold text-ok-fg">✓</span>}
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap text-xs tabular md:table-cell">
                            {mosDate ? fmtDate(mosDate) : '—'}
                          </TableCell>
                          <TableCell className="hidden max-w-56 text-[11.5px] leading-snug text-muted-foreground lg:table-cell">
                            <span className="line-clamp-3">{row.statusNote || '—'}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="m-0 shrink-0 rounded-none">
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button
            disabled={!selected.length || needsDiscipline > 0}
            onClick={() => { onConfirm(selected); reset(); }}
          >
            {selected.length ? `Import ${selected.length} item${selected.length === 1 ? '' : 's'}` : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
