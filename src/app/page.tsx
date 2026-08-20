'use client';

import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition,
} from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { DUMMY_PROJECT, DUMMY_ITEMS } from '@/lib/dummyData';

import AppSidebar from '@/components/AppSidebar';
import DeleteModal from '@/components/DeleteModal';
import type { ItemFormState } from '@/components/ItemFormModal';
import DashboardPage from '@/components/dashboard/DashboardPage';
import OverviewPage from '@/components/dashboard/OverviewPage';
import ItemDetail from '@/components/dashboard/ItemDetail';
import ProjectsPage from '@/components/projects/ProjectsPage';
import type { ProjectFormValues } from '@/components/projects/ProjectForm';
import {
  SidebarInset, SidebarProvider, SidebarTrigger,
} from '@/components/ui/sidebar';

import {
  genId,
  loadActiveProject,
  loadItems,
  loadProjects,
  loadSession,
  reconcileSeed,
  saveActiveProject,
  saveItems,
  saveProjects,
  saveSession,
} from '@/lib/store';
import type { VendorColumn, VendorImportResult } from '@/lib/vendorImport';
import { deriveStatus, STATUS_LABELS } from '@/lib/procurement';
import { appendEvents, createdEvent, diffItem } from '@/lib/itemLog';
import type {
  GroupBy, ImportedRow, ItemStatus, MilestoneEntry, PageName, ProcurementItem, Project,
} from '@/types';

/* ─────────────── the screens behind a button ───────────────
   Four dialogs, none of which is on the screen when the app opens, and
   between them a spreadsheet reader, a spreadsheet writer, a command palette
   and two long forms. Imported at the top they are simply part of the page:
   a phone downloads, parses and runs the lot before it may show the first
   list, to hold four things nobody has asked for yet. Behind `dynamic` each
   is fetched when it is first opened, which is a network round trip on a
   connection that has long since finished loading the app. */
const ImportModal    = dynamic(() => import('@/components/ImportModal'));
const ItemFormModal  = dynamic(() => import('@/components/ItemFormModal'));
const ProjectForm    = dynamic(() => import('@/components/projects/ProjectForm'));
const ProjectCommand = dynamic(() => import('@/components/ProjectCommand'));

/**
 * Holds a dialog back until it is first asked for, then leaves it mounted.
 *
 * Nothing above is fetched while this returns nothing, which is the point.
 * It stays after the first open rather than unmounting on close so the
 * closing animation still has something to play, and so opening it again is
 * immediate.
 */
function Deferred({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [summoned, setSummoned] = useState(open);
  // Set during the render that opened it — an effect would mount the dialog a
  // frame late, and the frame it costs is the one the tap is waiting on.
  if (open && !summoned) setSummoned(true);
  return summoned ? children : null;
}

/* ─────────────── helpers ─────────────── */
function buildMilestone(plan: string, fc: string, act: string, note: string): MilestoneEntry {
  return { plan, forecast: fc, actual: act, note };
}

/** Cut a list into the headed groups the overview renders. */
function groupItems(list: ProcurementItem[], groupBy: GroupBy) {
  const map = new Map<string, ProcurementItem[]>();
  for (const item of list) {
    const key = groupBy === 'discipline' ? item.discipline
      : groupBy === 'status'             ? item.status
      : item.vendor;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).map(([key, items]) => ({
    key,
    label: groupBy === 'status' ? STATUS_LABELS[key as ItemStatus] : key,
    items,
  }));
}

/* ─────────────── MAIN PAGE ─────────────── */
export default function ProcurementApp() {
  /** Where this tab was before it was reloaded, read once and never again.
   *
   *  In state rather than in a bare call so it is read on the first render
   *  and not on any of the ones after it — the value is a snapshot of a
   *  moment that has already passed, and re-reading it later would hand back
   *  a position the reader has since navigated away from. */
  const [restored] = useState(loadSession);

  /** Routing state runs through a transition so React may render the page it
   *  is being sent to without blocking the one on screen. */
  const [, startNav] = useTransition();

  /* ── Data state (lazily initialised to avoid cascading renders) ── */
  const [projects, setProjects] = useState<Project[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = loadProjects();
    if (stored.length > 0) return stored;
    saveProjects([DUMMY_PROJECT]);
    return [DUMMY_PROJECT];
  });

  const [items, setItems] = useState<ProcurementItem[]>(() => {
    if (typeof window === 'undefined') return [];
    // Seeds on a fresh install and refreshes a stale demo, both through the
    // same call — items typed into this browser survive either way.
    return reconcileSeed(loadItems(), DUMMY_ITEMS);
  });

  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = loadActiveProject();
    if (stored) return stored;
    saveActiveProject(DUMMY_PROJECT.id);
    return DUMMY_PROJECT.id;
  });

  /** The item the restored screen was showing, looked up while the list it
   *  came from is still the one that was saved alongside it.
   *
   *  It may be gone — deleted in another tab, or dropped by a seed refresh
   *  between the two loads. A missing item is not an error, it is simply a
   *  screen there is nothing to put on. */
  const [restoredItem] = useState<ProcurementItem | null>(() => (
    restored?.itemId ? items.find(i => i.id === restored.itemId) ?? null : null
  ));

  /** The screen the app opens on.
   *
   *  A reload is not a fresh visit: nothing was finished, nothing was chosen
   *  again, and the reader has the same thing in mind they had a second ago.
   *  So it opens where it was left. Only a tab that has no memory of being
   *  anywhere — a first visit, a new tab, a session that failed to load —
   *  gets the dashboard, which is the right front door for someone arriving
   *  rather than returning.
   *
   *  An item's screen with no item falls back to the list it was opened
   *  from, which is where closing it would have led anyway. */
  const [page, setPage] = useState<PageName>(() => {
    if (!restored) return 'dashboard';
    if (restored.page === 'itemDetail' && !restoredItem) return 'overview';
    return restored.page;
  });

  /* ── Overview filter / group ── */
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDisc, setFilterDisc]     = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const groupBy: GroupBy = 'discipline';

  /* ── Item detail ── */
  const [detailItem, setDetailItem] = useState<ProcurementItem | null>(restoredItem);

  /** The item whose detail screen was opened last.
   *
   *  Coming back, the overview uses it to reopen the pager on the page that
   *  row is actually on, rather than dropping the reader back at page one of
   *  a group they had already paged past. It is seeded on a reload for the
   *  same reason it is kept during a session: someone put back on an item's
   *  screen still came to it from a row somewhere down the list. */
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(restoredItem?.id ?? null);

  /* ── Item form modal ── */
  const [formOpen, setFormOpen]       = useState(false);
  const [editingItem, setEditingItem] = useState<ProcurementItem | null>(null);

  /* ── Excel import / export ── */
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting]   = useState(false);
  /**
   * Set when the import dialog was opened from one item's screen. The overview
   * takes anything — a returned form, a fresh schedule, new equipment — but an
   * item's own screen takes that item's form and nothing else.
   */
  const [importScope, setImportScope] = useState<ProcurementItem | null>(null);

  /* ── Delete modal ── */
  const [deleteOpen, setDeleteOpen]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'item' | 'project'; id: string; name: string;
  } | null>(null);

  /* ── Project create form ──
     Only whether it is open. What is typed into it lives inside the dialog,
     and arrives here once, on submit. */
  const [pfOpen, setPfOpen] = useState(false);

  /* ── Project quick-switch palette (⌘K) ── */
  const [paletteOpen, setPaletteOpen] = useState(false);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  /* The dialogs, fetched once the app is standing.
     Off the first load is where they belong, but "off the first load" and
     "fetched at the moment of the tap" are not the same thing: the second
     spends a round trip with the screen doing nothing, and on a phone that
     is the tap looking ignored. So they are asked for a beat after the app
     is usable, on a connection that is by then idle, and every tap after
     that opens on cached code.

     Not the workbook library. That one is a megabyte, it is wanted by two
     buttons out of the whole app, and most days by neither — it stays on
     demand, where the export and import paths ask for it themselves. */
  useEffect(() => {
    const id = window.setTimeout(() => {
      void import('@/components/ItemFormModal');
      void import('@/components/ImportModal');
      void import('@/components/projects/ProjectForm');
    }, 1200);
    return () => window.clearTimeout(id);
  }, []);

  /* The palette's shortcut, listened for here rather than inside the palette:
     the palette itself is not on the page until it is first opened, and a
     shortcut that needs the thing it opens to already be there is no use. */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      setPaletteOpen(open => !open);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  /* ── Derived ──
     Memoised for identity as much as for the arithmetic: these arrays are
     props on memoised children, and a fresh array on every render would defeat
     the memo before the numbers in it had even been looked at. */
  const activeProject = useMemo(
    () => projects.find(p => p.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );
  const projectItems = useMemo(
    () => (activeProject ? items.filter(i => i.projectId === activeProject.id) : items),
    [items, activeProject],
  );
  const attention = useMemo(
    () => projectItems.filter(i => i.status === 'late' || i.status === 'atrisk').length,
    [projectItems],
  );

  /* ─── Navigation ─── */

  /** Every page swap starts at the top of the page it lands on.
   *
   *  Nothing else belongs in here. An earlier pass gave each direction its
   *  own travel distance by writing a custom property to the root element,
   *  which measured at ~12ms of forced style recalc on every navigation —
   *  a whole document invalidated, synchronously, before React had even
   *  begun rendering the page being asked for. Which way a swap is going is
   *  already said by the row that flies between the list and the item it
   *  opens; it was not worth buying twice. */
  const startPageSwap = useCallback((update: () => void) => {
    startNav(update);
  }, [startNav]);

  /** The scroll reset, and it has to land in the same frame the new page does.
   *
   *  It used to run here on the way in, before `startNav` — which put it in
   *  the frame of the *click*, not the frame of the swap. A page swap is a
   *  transition, so React renders it when it can; measured on the way into an
   *  item from halfway down the overview, the scroll landed 7ms after the tap
   *  and the item's screen only 53ms after that. In between, for forty-six
   *  milliseconds — nearer a quarter of a second on a phone — the overview
   *  was still the page on screen, and it had just been yanked to its top.
   *  That was the flash of the list people saw before the item opened: not
   *  the item arriving late, but the list jumping first.
   *
   *  A layout effect runs after React has put the new page in the DOM and
   *  before the browser paints any of it, so the reset cannot be seen on its
   *  own — there is no frame in which it has happened and the swap has not.
   *  The outgoing snapshot is then taken where the reader actually left it,
   *  which is the honest thing for it to be a picture of; the group it is
   *  drawn in is pinned to its final size, so nothing about it moves. */
  /** Where the next scroll lands. Zero every time but the first, which is
   *  the one that carries the offset a reload was interrupted at. */
  const pendingScroll = useRef(restored?.scrollY ?? 0);

  useLayoutEffect(() => {
    // Nothing is on the page until `isMounted`, and scrolling a document that
    // has no height is a request to scroll to zero however far down the offset
    // says. So the first run is skipped without spending the offset, and the
    // flip to mounted runs this again — by which point React has committed a
    // page tall enough to have the position in it.
    if (!isMounted) return;
    const top = pendingScroll.current;
    pendingScroll.current = 0;
    window.scrollTo({ top, left: 0, behavior: 'instant' });
  }, [page, isMounted]);

  /** The browser's own scroll restoration has nothing to restore.
   *
   *  It runs shortly after load, and at that point this app has rendered
   *  nothing — the tree is held back until `isMounted`, so the document is
   *  its own height and there is nowhere to scroll to. Left on `auto` it
   *  either does nothing or lands a stale offset on top of the one above,
   *  depending on how the two happen to order. Turned off, the effect above
   *  is the only thing that moves the page, which is the only way this is
   *  predictable. Nothing is lost: the app has no history entries of its
   *  own for the browser to be restoring between. */
  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  /** Record the place, so the next load has one to go back to.
   *
   *  Twice, for two different failures. On every swap, because a tab that
   *  disappears without warning — a crash, a phone reclaiming memory — never
   *  gets the chance to say goodbye, and a screen without its scroll offset
   *  is still far better than the dashboard. And again on the way out, which
   *  is the only moment the scroll position is worth reading: during a swap
   *  it is always the top of a page nobody has looked at yet.
   *
   *  `pagehide` rather than `beforeunload`: the latter is ignored outright by
   *  mobile browsers, which discard a backgrounded tab without ever firing
   *  it. `visibilitychange` covers the case where the tab is never unloaded
   *  at all, only hidden and later killed. */
  const persist = useCallback(() => {
    // Before the page exists, `scrollY` is zero regardless of where the reader
    // was — writing then would overwrite the offset this load is on its way to
    // restoring. Effects run after layout effects, so the first write that
    // does happen is the one after the restore above, reading the position it
    // just put back.
    if (!isMounted) return;
    saveSession({
      page,
      itemId: detailItem?.id ?? null,
      scrollY: Math.round(window.scrollY),
    });
  }, [page, detailItem, isMounted]);

  useEffect(() => {
    persist();
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', persist);
    return () => {
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', persist);
    };
  }, [persist]);

  const nav = useCallback((p: PageName) => {
    // Leaving the list-and-detail pair behind: there is no list to come
    // back to a particular page of.
    if (p !== 'overview' && p !== 'itemDetail') setLastOpenedId(null);
    startPageSwap(() => setPage(p));
  }, [startPageSwap]);

  /** Which row this screen was opened from goes in with the swap, not ahead
   *  of it.
   *
   *  Set on its own it was an urgent update, and an urgent update to
   *  `lastOpenedId` is a prop change on every group card in the list: eight
   *  of them render again, each pager works out afresh which page holds the
   *  row, and the one that does rebuilds its carousel's context. All of it
   *  synchronous, all of it in the moment the finger goes down, and all of it
   *  to arrange a list that is about to be replaced. The transition then
   *  began on a thread that had just been made busy — which is the stutter on
   *  the way into an item.
   *
   *  Inside the transition it is the same work, deferred and batched with the
   *  swap it belongs to, and nobody is waiting on it: the value is only read
   *  again on the way back. */
  const openDetail = useCallback((item: ProcurementItem) => {
    startPageSwap(() => {
      setLastOpenedId(item.id);
      setDetailItem(item);
      setPage('itemDetail');
    });
  }, [startPageSwap]);

  const goOverview = useCallback(() => nav('overview'), [nav]);

  /* ─── Project CRUD ─── */
  function handleCreateProject(values: ProjectFormValues) {
    if (!values.name.trim()) { toast.error('Project name is required'); return; }
    const proj: Project = {
      id: genId(),
      name: values.name.trim(),
      client: values.client.trim(),
      location: values.location.trim(),
      pic: values.pic.trim(),
      contractNo: values.contractNo.trim(),
      handover: values.handover,
      createdAt: new Date().toISOString(),
    };
    const updated = [...projects, proj];
    setProjects(updated);
    saveProjects(updated);
    setActiveProjectId(proj.id);
    saveActiveProject(proj.id);
    setPfOpen(false);
    toast.success(`Project “${proj.name}” created.`);
  }

  const handleSelectProject = useCallback((id: string) => {
    setActiveProjectId(id);
    saveActiveProject(id);
  }, []);

  const confirmDeleteProject = useCallback((proj: Project) => {
    setDeleteTarget({ type: 'project', id: proj.id, name: proj.name });
    setDeleteOpen(true);
  }, []);

  const openProject = useCallback((id: string) => {
    handleSelectProject(id);
    nav('overview');
  }, [handleSelectProject, nav]);

  const deleteActiveProject = useCallback(() => {
    if (activeProject) confirmDeleteProject(activeProject);
  }, [activeProject, confirmDeleteProject]);

  function doDeleteProject() {
    if (!deleteTarget || deleteTarget.type !== 'project') return;
    const updated      = projects.filter(p => p.id !== deleteTarget.id);
    const updatedItems = items.filter(i => i.projectId !== deleteTarget.id);
    setProjects(updated);      saveProjects(updated);
    setItems(updatedItems);    saveItems(updatedItems);
    if (activeProjectId === deleteTarget.id) {
      const next = updated[0]?.id ?? null;
      setActiveProjectId(next);
      saveActiveProject(next);
    }
    setDeleteOpen(false);
    toast.success('Project deleted.');
  }

  /* ─── Item CRUD ─── */
  function openItemForm(item?: ProcurementItem) {
    setEditingItem(item ?? null);
    setFormOpen(true);
  }

  function closeItemForm() {
    setFormOpen(false);
    setEditingItem(null);
  }

  function handleSaveItem(form: ItemFormState) {
    const base: Omit<
      ProcurementItem, 'id' | 'status' | 'progress' | 'createdAt' | 'events'
    > = {
      projectId: activeProject?.id ?? '',
      desc: form.desc.trim(),
      discipline: form.discipline,
      qty: Number(form.qty),
      unit: form.unit.trim(),
      vendor: form.vendor.trim(),
      vendorPic: form.vendorPic.trim(),
      vendorPhone: form.vendorPhone.trim(),
      brand: form.brand.trim(),
      delivery: form.delivery.trim(),
      poNo: form.poNo.trim(),
      poDate: form.poDate,
      statusNote: form.statusNote.trim(),
      readinessDoc: Math.max(0, Math.min(1, (Number(form.readinessDoc) || 0) / 100)),
      doNo: form.doNo.trim(),
      termOfPayment: form.termOfPayment.trim(),
      mfg: {
        plan: Math.max(0, Math.min(1, (Number(form.mfgPlan) || 0) / 100)),
        actual: Math.max(0, Math.min(1, (Number(form.mfgActual) || 0) / 100)),
        note: form.mfgNote.trim(),
      },
      fat: buildMilestone(form.fatPlan, form.fatFc, form.fatAct, form.fatNote),
      rts: buildMilestone(form.rtsPlan, form.rtsFc, form.rtsAct, form.rtsNote),
      mos: buildMilestone(form.mosPlan, form.mosFc, form.mosAct, form.mosNote),
    };
    const derived = deriveStatus(base as ProcurementItem);

    // Hand edits are logged the same way an import is, so the update log on the
    // detail page reads as one history rather than only what vendors sent.
    const actor = activeProject?.pic || 'Procurement';

    if (editingItem) {
      const draft = { ...editingItem, ...base, ...derived };
      const next: ProcurementItem = {
        ...draft,
        events: appendEvents(
          editingItem,
          diffItem(editingItem, draft, { source: 'manual', actor }),
        ),
      };
      const updated = items.map(i => (i.id === next.id ? next : i));
      setItems(updated);
      saveItems(updated);
      if (detailItem?.id === next.id) setDetailItem(next);
      toast.success('Item updated.');
    } else {
      const newItem: ProcurementItem = {
        ...base,
        id: genId(),
        ...derived,
        createdAt: new Date().toISOString(),
        events: [createdEvent({ source: 'created', actor })],
      };
      const updated = [...items, newItem];
      setItems(updated);
      saveItems(updated);
      toast.success('Item added.');
    }
    closeItemForm();
  }

  /* ─── Excel ─── */

  /** Apply reviewed rows: update items matched by PO + description, insert the rest. */
  function handleImportConfirm(rows: ImportedRow[]) {
    const projectId = activeProject?.id ?? '';
    const byId = new Map(items.map(i => [i.id, i]));
    let updated = 0, inserted = 0;

    // One timestamp for the whole batch, so the update log groups the import
    // as a single event rather than scattering it across the same second.
    const logCtx = {
      source: 'own-import' as const,
      actor: activeProject?.pic || 'Procurement',
      at: new Date().toISOString(),
    };

    for (const row of rows) {
      const base = {
        projectId,
        desc: row.desc,
        discipline: row.discipline,
        qty: row.qty,
        unit: row.unit,
        vendor: row.vendor,
        brand: row.brand,
        delivery: row.delivery,
        poNo: row.poNo,
        poDate: row.poDate,
        statusNote: row.statusNote,
        readinessDoc: row.readinessDoc,
        doNo: row.doNo,
        termOfPayment: row.termOfPayment,
        fat: row.fat,
        rts: row.rts,
        mos: row.mos,
      };
      const derived = deriveStatus(base as ProcurementItem);

      if (row.matchesItemId && byId.has(row.matchesItemId)) {
        const existing = byId.get(row.matchesItemId)!;
        const draft = { ...existing, ...base, ...derived };
        byId.set(existing.id, {
          ...draft,
          events: appendEvents(existing, diffItem(existing, draft, logCtx)),
        });
        updated++;
      } else {
        const item: ProcurementItem = {
          // The older sheet format carries neither a vendor contact nor a
          // manufacturing figure; both get filled in by hand or by the next
          // vendor form.
          vendorPic: '', vendorPhone: '',
          mfg: { plan: 0, actual: 0, note: '' },
          ...base,
          id: genId(),
          ...derived,
          createdAt: new Date().toISOString(),
          events: [createdEvent(logCtx)],
        };
        byId.set(item.id, item);
        inserted++;
      }
    }

    const next = Array.from(byId.values());
    startNav(() => {
      setItems(next);
      setImportScope(null);
      setImportOpen(false);
    });
    saveItems(next);
    toast.success('Import complete', {
      description: `${inserted} new item${inserted === 1 ? '' : 's'}${updated ? `, ${updated} updated` : ''}.`,
    });
  }

  /** Write the workbook and bump the project revision so the sheet header stays in step. */
  async function handleExport() {
    if (!projectItems.length) { toast.error('No items to export yet.'); return; }
    setExporting(true);
    try {
      const { exportWorkbook } = await import('@/lib/excelExport');
      const { revision, fileName } = await exportWorkbook(activeProject, projectItems);
      if (activeProject) {
        const nextProjects = projects.map(p =>
          p.id === activeProject.id ? { ...p, revision } : p,
        );
        setProjects(nextProjects);
        saveProjects(nextProjects);
      }
      toast.success(`Excel rev.${revision} downloaded`, { description: fileName });
    } catch (err) {
      toast.error('Export failed', { description: (err as Error).message });
    } finally {
      setExporting(false);
    }
  }

  /** One vendor's progress form. No revision bump: this is not the client's copy. */
  async function handleExportVendor(vendor: string) {
    setExporting(true);
    try {
      const { exportVendorWorkbook } = await import('@/lib/vendorSheet');
      const fileName = await exportVendorWorkbook(activeProject, vendor, projectItems);
      toast.success(`Form for ${vendor} downloaded`, { description: fileName });
    } catch (err) {
      toast.error('Export failed', { description: (err as Error).message });
    } finally {
      setExporting(false);
    }
  }

  /**
   * The form for one item, cut from its own screen.
   *
   * No revision bump: like the vendor form, this is a working file sent out to
   * be filled in, not the copy the client is given.
   */
  async function handleExportItemForm(item: ProcurementItem) {
    setExporting(true);
    try {
      const { exportItemForm } = await import('@/lib/vendorSheet');
      const fileName = await exportItemForm(activeProject, item);
      toast.success('Progress form downloaded', { description: fileName });
    } catch (err) {
      toast.error('Export failed', { description: (err as Error).message });
    } finally {
      setExporting(false);
    }
  }

  /** Opened bare from the overview, or against one item from its own screen. */
  function openImport(scope: ProcurementItem | null = null) {
    setImportScope(scope);
    setImportOpen(true);
  }

  function closeImport() {
    setImportOpen(false);
    setImportScope(null);
  }

  /** Apply a returned vendor form: reviewed changes only, each one logged. */
  async function handleVendorImport(result: VendorImportResult, columns: VendorColumn[]) {
    // Already in cache: the dialog that produced this result read the form
    // with the very same module.
    const { applyVendorImport } = await import('@/lib/vendorImport');
    const applied = applyVendorImport(items, result, columns);
    startNav(() => {
      setItems(applied.items);
      setImportScope(null);
      setImportOpen(false);
    });
    saveItems(applied.items);

    // The detail screen may be showing one of the items that just moved.
    if (detailItem) {
      const fresh = applied.items.find(i => i.id === detailItem.id);
      if (fresh) setDetailItem(fresh);
    }

    if (!applied.updated && !applied.restored) {
      toast.info('Nothing to apply', { description: 'The form held no new information.' });
      return;
    }

    /* A form can now update what is here and put back what is not, and a
       toast naming only one of the two reads as the whole of what happened. */
    const done: string[] = [];
    if (applied.changed) {
      done.push(`${applied.changed} change${applied.changed === 1 ? '' : 's'} across `
        + `${applied.updated} item${applied.updated === 1 ? '' : 's'}`);
    }
    if (applied.restored) {
      done.push(`${applied.restored} item${applied.restored === 1 ? '' : 's'} put back`);
    }
    toast.success(`${result.vendor || 'Vendor'} form applied`, {
      description: `${done.join(' · ')}.`,
    });
  }

  function confirmDeleteItem(item: ProcurementItem) {
    setDeleteTarget({ type: 'item', id: item.id, name: item.desc });
    setDeleteOpen(true);
  }

  function doDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'item') {
      const updated = items.filter(i => i.id !== deleteTarget.id);
      setItems(updated);
      saveItems(updated);
      if (detailItem?.id === deleteTarget.id) {
        // The row this screen would return to no longer exists.
        setLastOpenedId(null);
        startPageSwap(() => {
          setDetailItem(null);
          setPage('overview');
        });
      }
      toast.success('Item deleted.');
      setDeleteOpen(false);
    } else {
      doDeleteProject();
    }
  }

  /* ─── Computed overview data ───
     Memoised for identity above all. Every one of these is a fresh array on
     each render, and each is a prop on a memoised child — the group cards
     down the overview take these objects and nothing else. Recomputed on
     every keystroke, every dialog opening, every export finishing, they hand
     the list eight new groups that hold the same items as before, and eighty
     rows render again to draw exactly what is already on the screen. */
  const filteredItems = useMemo(() => projectItems.filter(item => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      [item.desc, item.vendor, item.brand, item.poNo, item.discipline]
        .some(v => v.toLowerCase().includes(q));
    const matchStatus = !filterStatus || item.status === filterStatus;
    const matchDisc   = !filterDisc   || item.discipline === filterDisc;
    const matchVendor = !filterVendor || item.vendor === filterVendor;
    return matchSearch && matchStatus && matchDisc && matchVendor;
  }), [projectItems, search, filterStatus, filterDisc, filterVendor]);

  const hasFilters = !!(search || filterStatus || filterDisc || filterVendor);

  const grouped = useMemo(
    () => groupItems(filteredItems, groupBy),
    [filteredItems, groupBy],
  );

  const uniqueVendors = useMemo(
    () => Array.from(new Set(projectItems.map(i => i.vendor).filter(Boolean))),
    [projectItems],
  );
  const uniqueDiscs = useMemo(
    () => Array.from(new Set(projectItems.map(i => i.discipline).filter(Boolean))),
    [projectItems],
  );

  /* ─────── RENDER ─────── */
  if (!isMounted) return null;

  return (
    <SidebarProvider>
      <AppSidebar page={page} attention={attention} onNavigate={nav} />

      <SidebarInset>
        {/* The bar rides along the top rather than scrolling away with the
            page: the menu, and the project it belongs to, stay one tap from
            the bottom of a long list instead of a scroll back up. Riding
            there means the page now passes underneath it, which is what the
            solid ground and the rule below it are for. */}
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 sm:px-4">
          <SidebarTrigger className="-ml-1" />
          {/* The project, and nothing else. Every page carries its own title a
              few lines down, so naming it up here only said the same thing
              twice on one screen. */}
          <button
            type="button"
            onClick={() => nav('projects')}
            className="-mx-1 min-w-0 cursor-pointer truncate rounded-md px-1 text-sm font-medium transition-colors outline-none hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {activeProject?.name ?? 'Procurement'}
          </button>
        </header>

        {/* The cap is set past the width of an ordinary laptop on purpose: up
            to there the page stays fluid and the gutters read as margin rather
            than as a column of dead space, and only a genuinely wide monitor
            ever sees it bite — at which point a line of text has grown long
            enough that stopping is the kinder choice. */}
        <main className="mx-auto w-full max-w-[1440px] px-4 pt-5 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 sm:pb-24 lg:px-8 xl:px-10 2xl:px-12">
          {/* Keyed on the page so the arrival runs again on every swap. See
              .page-arrive, which replaced a snapshot that could not be made to
              behave between pages of such different heights. */}
          <div key={page} className="page-arrive">
            <div>
              {page === 'dashboard' && (
                <DashboardPage
                  project={activeProject}
                  items={projectItems}
                  onOpenItem={openDetail}
                  onImport={() => openImport()}
                />
              )}

              {page === 'projects' && (
                <ProjectsPage
                  projects={projects}
                  items={items}
                  activeProject={activeProject}
                  activeProjectId={activeProjectId}
                  onFormOpenChange={setPfOpen}
                  onSelectProject={handleSelectProject}
                  onOpenProject={openProject}
                  onDeleteProject={confirmDeleteProject}
                  onGoOverview={goOverview}
                  onDeleteActiveProject={deleteActiveProject}
                />
              )}

              {page === 'overview' && (
                <OverviewPage
                  projectItems={projectItems}
                  filteredItems={filteredItems}
                  grouped={grouped}
                  groupBy={groupBy}
                  search={search}
                  filterStatus={filterStatus}
                  filterDisc={filterDisc}
                  filterVendor={filterVendor}
                  hasFilters={hasFilters}
                  uniqueDiscs={uniqueDiscs}
                  uniqueVendors={uniqueVendors}
                  hasProject={!!activeProject}
                  onSearch={setSearch}
                  onFilterStatus={setFilterStatus}
                  onFilterDisc={setFilterDisc}
                  onFilterVendor={setFilterVendor}
                  onClearFilters={() => {
                    setSearch(''); setFilterStatus(''); setFilterDisc(''); setFilterVendor('');
                  }}
                  onImport={() => openImport()}
                  onExport={handleExport}
                  onExportVendor={handleExportVendor}
                  exporting={exporting}
                  onAddItem={() => openItemForm()}
                  onOpenDetail={openDetail}
                  lastOpenedId={lastOpenedId}
                />
              )}

              {page === 'itemDetail' && detailItem && (
                <ItemDetail
                  item={detailItem}
                  onBack={() => nav('overview')}
                  onEdit={item => openItemForm(item)}
                  onDelete={item => confirmDeleteItem(item)}
                  onExportForm={handleExportItemForm}
                  onImportForm={item => openImport(item)}
                  exporting={exporting}
                />
              )}
            </div>
          </div>
        </main>
      </SidebarInset>

      {/* Up here with the other dialogs rather than inside the projects page,
          so opening it is a change the page can sit out. */}
      <Deferred open={pfOpen}>
        <ProjectForm
          open={pfOpen}
          onOpenChange={setPfOpen}
          onSubmit={handleCreateProject}
        />
      </Deferred>

      {/* Lives outside the page switch: the shortcut works from any screen. */}
      <Deferred open={paletteOpen}>
        <ProjectCommand
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          projects={projects}
          items={items}
          activeProjectId={activeProjectId}
          onSelectProject={handleSelectProject}
          onNavigate={nav}
          onCreateProject={() => { nav('projects'); setPfOpen(true); }}
        />
      </Deferred>

      <Deferred open={importOpen}>
        <ImportModal
          open={importOpen}
          existingItems={projectItems}
          projectId={activeProject?.id ?? ''}
          scopeItem={importScope}
          onClose={closeImport}
          onConfirm={handleImportConfirm}
          onConfirmVendor={handleVendorImport}
        />
      </Deferred>

      <Deferred open={formOpen}>
        <ItemFormModal
          open={formOpen}
          editingItem={editingItem}
          onClose={closeItemForm}
          onSave={handleSaveItem}
        />
      </Deferred>

      <DeleteModal
        open={deleteOpen}
        title={deleteTarget?.type === 'project' ? 'Delete project?' : 'Delete item?'}
        desc={
          deleteTarget?.type === 'project'
            ? `“${deleteTarget?.name}” and all of its procurement items will be permanently deleted.`
            : `“${deleteTarget?.name}” will be permanently deleted.`
        }
        onCancel={() => setDeleteOpen(false)}
        onConfirm={doDelete}
      />
    </SidebarProvider>
  );
}
