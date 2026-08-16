'use client';

import { ViewTransition, useEffect, useState, useTransition } from 'react';
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
import {
  SidebarInset, SidebarProvider, SidebarTrigger,
} from '@/components/ui/sidebar';

import {
  genId,
  loadActiveProject,
  loadItems,
  loadProjects,
  saveActiveProject,
  saveItems,
  saveProjects,
} from '@/lib/store';
import { exportWorkbook } from '@/lib/excelExport';
import { deriveStatus, STATUS_LABELS } from '@/lib/procurement';
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
    const stored = loadItems();
    if (stored.length > 0) return stored;
    saveItems(DUMMY_ITEMS);
    return DUMMY_ITEMS;
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
  const [groupBy, setGroupBy]           = useState<GroupBy>('discipline');

  /* ── Item detail ── */
  const [detailItem, setDetailItem] = useState<ProcurementItem | null>(null);

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

  /* ── Project create form ── */
  const [pfForm, setPfForm] = useState({
    name: '', client: '', location: '', pic: '', contractNo: '', handover: '',
  });

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  /* ── Derived ── */
  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;
  const projectItems  = activeProject ? items.filter(i => i.projectId === activeProject.id) : items;
  const attention     = projectItems.filter(i => i.status === 'late' || i.status === 'atrisk').length;

  /* ─── Navigation ─── */

  /** Every page swap starts at the top of the page it lands on.
   *
   *  Two reasons to reset here rather than after the fact: landing halfway
   *  down a screen you have never seen reads as a glitch, and the view
   *  transition snapshots the old page where it currently sits — so the
   *  scroll has to settle in the same frame the snapshot is taken, or the
   *  outgoing image animates from one place while the incoming one starts
   *  from another. */
  function startPageSwap(update: () => void) {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    startNav(update);
  }

  function nav(p: PageName) {
    startPageSwap(() => setPage(p));
  }

  function openDetail(item: ProcurementItem) {
    startPageSwap(() => {
      setDetailItem(item);
      setPage('itemDetail');
    });
  }

  /* ─── Project CRUD ─── */
  function handleCreateProject() {
    if (!pfForm.name.trim()) { toast.error('Project name is required'); return; }
    const proj: Project = {
      id: genId(),
      name: pfForm.name.trim(),
      client: pfForm.client.trim(),
      location: pfForm.location.trim(),
      pic: pfForm.pic.trim(),
      contractNo: pfForm.contractNo.trim(),
      handover: pfForm.handover,
      createdAt: new Date().toISOString(),
    };
    const updated = [...projects, proj];
    setProjects(updated);
    saveProjects(updated);
    setActiveProjectId(proj.id);
    saveActiveProject(proj.id);
    setPfForm({ name: '', client: '', location: '', pic: '', contractNo: '', handover: '' });
    toast.success(`Project “${proj.name}” created.`);
  }

  function handleSelectProject(id: string) {
    setActiveProjectId(id);
    saveActiveProject(id);
  }

  function confirmDeleteProject(proj: Project) {
    setDeleteTarget({ type: 'project', id: proj.id, name: proj.name });
    setDeleteOpen(true);
  }

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
    const base: Omit<ProcurementItem, 'id' | 'status' | 'progress' | 'createdAt'> = {
      projectId: activeProject?.id ?? '',
      desc: form.desc.trim(),
      discipline: form.discipline,
      qty: Number(form.qty),
      unit: form.unit.trim(),
      vendor: form.vendor.trim(),
      brand: form.brand.trim(),
      delivery: form.delivery.trim(),
      poNo: form.poNo.trim(),
      poDate: form.poDate,
      statusNote: form.statusNote.trim(),
      readinessDoc: Math.max(0, Math.min(1, (Number(form.readinessDoc) || 0) / 100)),
      doNo: form.doNo.trim(),
      termOfPayment: form.termOfPayment.trim(),
      fat: buildMilestone(form.fatPlan, form.fatFc, form.fatAct, form.fatNote),
      rts: buildMilestone(form.rtsPlan, form.rtsFc, form.rtsAct, form.rtsNote),
      mos: buildMilestone(form.mosPlan, form.mosFc, form.mosAct, form.mosNote),
    };
    const derived = deriveStatus(base as ProcurementItem);

    if (editingItem) {
      const updated = items.map(i =>
        i.id === editingItem.id ? { ...i, ...base, ...derived } : i
      );
      setItems(updated);
      saveItems(updated);
      if (detailItem?.id === editingItem.id) {
        setDetailItem({ ...editingItem, ...base, ...derived });
      }
      toast.success('Item updated.');
    } else {
      const newItem: ProcurementItem = {
        ...base, id: genId(), ...derived, createdAt: new Date().toISOString(),
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
        byId.set(existing.id, { ...existing, ...base, ...derived });
        updated++;
      } else {
        const item: ProcurementItem = {
          ...base, id: genId(), ...derived, createdAt: new Date().toISOString(),
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
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-sm sm:px-4">
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
                  form={pfForm}
                  onFormChange={(field, value) => setPfForm(f => ({ ...f, [field]: value }))}
                  onCreateProject={handleCreateProject}
                  onSelectProject={handleSelectProject}
                  onDeleteProject={confirmDeleteProject}
                  onGoOverview={() => nav('overview')}
                  onDeleteActiveProject={() => activeProject && confirmDeleteProject(activeProject)}
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
                  onGroupBy={setGroupBy}
                  onImport={() => setImportOpen(true)}
                  onExport={handleExport}
                  exporting={exporting}
                  onAddItem={() => openItemForm()}
                  onOpenDetail={openDetail}
                />
              )}

              {page === 'itemDetail' && detailItem && (
                <ItemDetail
                  item={detailItem}
                  onBack={() => nav('overview')}
                  onEdit={item => openItemForm(item)}
                  onDelete={item => confirmDeleteItem(item)}
                />
              )}
            </div>
          </ViewTransition>
        </main>
      </SidebarInset>

      <ImportModal
        open={importOpen}
        existingItems={projectItems}
        onClose={() => setImportOpen(false)}
        onConfirm={handleImportConfirm}
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
