'use client';

import { ViewTransition, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { DUMMY_PROJECT, DUMMY_ITEMS } from '@/lib/dummyData';

import AppSidebar from '@/components/AppSidebar';
import DeleteModal from '@/components/DeleteModal';
import ImportModal from '@/components/ImportModal';
import ItemFormModal from '@/components/ItemFormModal';
import type { ItemFormState } from '@/components/ItemFormModal';
import DashboardPage from '@/components/dashboard/DashboardPage';
import OverviewPage from '@/components/dashboard/OverviewPage';
import ItemDetail from '@/components/dashboard/ItemDetail';
import ProjectsPage from '@/components/projects/ProjectsPage';
import ProjectForm, { type ProjectFormValues } from '@/components/projects/ProjectForm';
import ProjectCommand from '@/components/ProjectCommand';
import {
  SidebarInset, SidebarProvider, SidebarTrigger,
} from '@/components/ui/sidebar';

import {
  genId,
  loadActiveProject,
  loadItems,
  loadProjects,
  reconcileSeed,
  saveActiveProject,
  saveItems,
  saveProjects,
} from '@/lib/store';
import { exportWorkbook } from '@/lib/excelExport';
import { exportVendorWorkbook } from '@/lib/vendorSheet';
import { applyVendorImport, type VendorColumn, type VendorImportResult } from '@/lib/vendorImport';
import { deriveStatus, STATUS_LABELS } from '@/lib/procurement';
import { appendEvents, createdEvent, diffItem } from '@/lib/itemLog';
import type {
  GroupBy, ImportedRow, ItemStatus, MilestoneEntry, PageName, ProcurementItem, Project,
} from '@/types';

/* ─────────────── helpers ─────────────── */
function buildMilestone(plan: string, fc: string, act: string, note: string): MilestoneEntry {
  return { plan, forecast: fc, actual: act, note };
}

/* ─────────────── MAIN PAGE ─────────────── */
export default function ProcurementApp() {
  const [page, setPage] = useState<PageName>('dashboard');

  /** Routing state runs through a transition so <ViewTransition> can animate it. */
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

  /* ── Overview filter / group ── */
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDisc, setFilterDisc]     = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const groupBy: GroupBy = 'discipline';

  /* ── Item detail ── */
  const [detailItem, setDetailItem] = useState<ProcurementItem | null>(null);

  /** The one row allowed to fly between the list and the detail screen.
   *
   *  Naming every row would hand the browser a separate snapshot per item
   *  and cut that many holes in the page snapshot, for a morph only one of
   *  them will ever run. Only the row being opened is named, and only while
   *  the list and the screen it opens are the two ends in play. */
  const [morphItemId, setMorphItemId] = useState<string | null>(null);

  /* ── Item form modal ── */
  const [formOpen, setFormOpen]       = useState(false);
  const [editingItem, setEditingItem] = useState<ProcurementItem | null>(null);

  /* ── Excel import / export ── */
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting]   = useState(false);

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
   *  Two reasons to reset here rather than after the fact: landing halfway
   *  down a screen you have never seen reads as a glitch, and the view
   *  transition snapshots the old page where it currently sits — so the
   *  scroll has to settle in the same frame the snapshot is taken, or the
   *  outgoing image animates from one place while the incoming one starts
   *  from another.
   *
   *  Nothing else belongs in here. An earlier pass gave each direction its
   *  own travel distance by writing a custom property to the root element,
   *  which measured at ~12ms of forced style recalc on every navigation —
   *  a whole document invalidated, synchronously, before React had even
   *  begun rendering the page being asked for. Which way a swap is going is
   *  already said by the row that flies between the list and the item it
   *  opens; it was not worth buying twice. */
  const startPageSwap = useCallback((update: () => void) => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    startNav(update);
  }, [startNav]);

  const nav = useCallback((p: PageName) => {
    // Leaving the list-and-detail pair behind: nothing left to fly between,
    // and a name with only one end to it animates on its own.
    if (p !== 'overview' && p !== 'itemDetail') setMorphItemId(null);
    startPageSwap(() => setPage(p));
  }, [startPageSwap]);

  const openDetail = useCallback((item: ProcurementItem) => {
    setMorphItemId(item.id);
    startPageSwap(() => {
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
      const fileName = await exportVendorWorkbook(activeProject, vendor, projectItems);
      toast.success(`Form for ${vendor} downloaded`, { description: fileName });
    } catch (err) {
      toast.error('Export failed', { description: (err as Error).message });
    } finally {
      setExporting(false);
    }
  }

  /** Apply a returned vendor form: reviewed changes only, each one logged. */
  function handleVendorImport(result: VendorImportResult, columns: VendorColumn[]) {
    const applied = applyVendorImport(items, result, columns);
    startNav(() => {
      setItems(applied.items);
      setImportOpen(false);
    });
    saveItems(applied.items);

    // The detail screen may be showing one of the items that just moved.
    if (detailItem) {
      const fresh = applied.items.find(i => i.id === detailItem.id);
      if (fresh) setDetailItem(fresh);
    }

    if (!applied.updated) {
      toast.info('Nothing to apply', { description: 'The form held no new information.' });
      return;
    }
    toast.success(`${result.vendor || 'Vendor'} form applied`, {
      description: `${applied.changed} change${applied.changed === 1 ? '' : 's'} across `
        + `${applied.updated} item${applied.updated === 1 ? '' : 's'}.`,
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
        // The row this screen would fly back to no longer exists.
        setMorphItemId(null);
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

  /* ─── Computed overview data ─── */
  const filteredItems = projectItems.filter(item => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      [item.desc, item.vendor, item.brand, item.poNo, item.discipline]
        .some(v => v.toLowerCase().includes(q));
    const matchStatus = !filterStatus || item.status === filterStatus;
    const matchDisc   = !filterDisc   || item.discipline === filterDisc;
    const matchVendor = !filterVendor || item.vendor === filterVendor;
    return matchSearch && matchStatus && matchDisc && matchVendor;
  });

  const hasFilters = !!(search || filterStatus || filterDisc || filterVendor);

  function groupItems(list: ProcurementItem[]) {
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

  const grouped       = groupItems(filteredItems);
  const uniqueVendors = Array.from(new Set(projectItems.map(i => i.vendor).filter(Boolean)));
  const uniqueDiscs   = Array.from(new Set(projectItems.map(i => i.discipline).filter(Boolean)));

  /* ─────── RENDER ─────── */
  if (!isMounted) return null;

  return (
    <SidebarProvider>
      <AppSidebar page={page} attention={attention} onNavigate={nav} />

      <SidebarInset>
        {/* The bar scrolls away with the page rather than riding along the top.
            Nothing ever passes underneath it, so it needs neither a rule, a
            translucent background, nor the blur those were there to support. */}
        <header className="flex h-14 shrink-0 items-center gap-2 px-3 sm:px-4">
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
          <ViewTransition key={page} name="app-page" share="auto" enter="auto" exit="auto" default="none">
            <div>
              {page === 'dashboard' && (
                <DashboardPage
                  project={activeProject}
                  items={projectItems}
                  onOpenItem={openDetail}
                  onImport={() => setImportOpen(true)}
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
                  onImport={() => setImportOpen(true)}
                  onExport={handleExport}
                  onExportVendor={handleExportVendor}
                  exporting={exporting}
                  onAddItem={() => openItemForm()}
                  onOpenDetail={openDetail}
                  morphItemId={morphItemId}
                />
              )}

              {page === 'itemDetail' && detailItem && (
                <ItemDetail
                  item={detailItem}
                  morph={morphItemId === detailItem.id}
                  onBack={() => nav('overview')}
                  onEdit={item => openItemForm(item)}
                  onDelete={item => confirmDeleteItem(item)}
                />
              )}
            </div>
          </ViewTransition>
        </main>
      </SidebarInset>

      {/* Up here with the other dialogs rather than inside the projects page,
          so opening it is a change the page can sit out. */}
      <ProjectForm
        open={pfOpen}
        onOpenChange={setPfOpen}
        onSubmit={handleCreateProject}
      />

      {/* Lives outside the page switch: the shortcut works from any screen. */}
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

      <ImportModal
        open={importOpen}
        existingItems={projectItems}
        projectId={activeProject?.id ?? ''}
        onClose={() => setImportOpen(false)}
        onConfirm={handleImportConfirm}
        onConfirmVendor={handleVendorImport}
      />

      <ItemFormModal
        open={formOpen}
        editingItem={editingItem}
        onClose={closeItemForm}
        onSave={handleSaveItem}
      />

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
