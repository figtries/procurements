'use client';

import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
  function nav(p: PageName) {
    setPage(p);
    setSidebarOpen(false);
  }

  /* ─── Project CRUD ─── */
  function handleCreateProject() {
    if (!pfForm.name.trim()) { toast.error('Nama project wajib diisi'); return; }
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
    toast.success(`Project "${proj.name}" dibuat.`);
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
    toast.success('Project dihapus.');
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
      toast.success('Item diperbarui.');
    } else {
      const newItem: ProcurementItem = {
        ...base, id: genId(), ...derived, createdAt: new Date().toISOString(),
      };
      const updated = [...items, newItem];
      setItems(updated);
      saveItems(updated);
      toast.success('Item ditambahkan.');
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
    setItems(next);
    saveItems(next);
    setImportOpen(false);
    toast.success('Import selesai', {
      description: `${inserted} item baru${updated ? `, ${updated} diperbarui` : ''}.`,
    });
  }

  /** Write the workbook and bump the project revision so the sheet header stays in step. */
  async function handleExport() {
    if (!projectItems.length) { toast.error('Belum ada item untuk di-export.'); return; }
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
      toast.success(`Excel rev.${revision} diunduh`, { description: fileName });
    } catch (err) {
      toast.error('Export gagal', { description: (err as Error).message });
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
        setDetailItem(null);
        setPage('overview');
      }
      toast.success('Item dihapus.');
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

  const sidebar = (
    <AppSidebar
      page={page}
      attention={attention}
      exporting={exporting}
      onNavigate={nav}
      onImport={() => { setImportOpen(true); setSidebarOpen(false); }}
      onExport={() => { handleExport(); setSidebarOpen(false); }}
    />
  );

  /* ─────── RENDER ─────── */
  if (!isMounted) return null;

  return (
    <>
      <div className="min-h-svh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
        {/* Desktop rail */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 overflow-y-auto border-r bg-sidebar text-sidebar-foreground lg:block">
          {sidebar}
        </aside>
        <div className="hidden lg:block" aria-hidden />

        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:hidden">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger render={<Button variant="outline" size="icon" aria-label="Buka menu" />}>
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
              <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
              {sidebar}
            </SheetContent>
          </Sheet>
          <span className="truncate text-sm font-semibold">
            {activeProject?.name ?? 'Procurement'}
          </span>
        </header>

        {/* Main */}
        <main className="mx-auto w-full max-w-[1120px] px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:pt-11">
          {page === 'dashboard' && (
            <DashboardPage
              project={activeProject}
              items={projectItems}
              onOpenItem={item => { setDetailItem(item); setPage('itemDetail'); }}
              onImport={() => setImportOpen(true)}
              onExport={handleExport}
              exporting={exporting}
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
              projectName={activeProject?.name ?? ''}
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
              onClearFilters={() => { setSearch(''); setFilterStatus(''); setFilterDisc(''); setFilterVendor(''); }}
              onGroupBy={setGroupBy}
              onAddProject={() => nav('projects')}
              onAddItem={() => openItemForm()}
              onOpenDetail={item => { setDetailItem(item); setPage('itemDetail'); }}
            />
          )}

          {page === 'itemDetail' && detailItem && (
            <ItemDetail
              item={detailItem}
              onBack={() => setPage('overview')}
              onEdit={item => openItemForm(item)}
              onDelete={item => confirmDeleteItem(item)}
            />
          )}
        </main>
      </div>

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
        title={deleteTarget?.type === 'project' ? 'Hapus project?' : 'Hapus item?'}
        desc={
          deleteTarget?.type === 'project'
            ? `"${deleteTarget?.name}" beserta seluruh item procurement-nya akan dihapus permanen.`
            : `"${deleteTarget?.name}" akan dihapus permanen.`
        }
        onCancel={() => setDeleteOpen(false)}
        onConfirm={doDelete}
      />
    </>
  );
}
