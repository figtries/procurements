'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DUMMY_PROJECT, DUMMY_ITEMS } from '@/lib/dummyData';

import BrandLogo from '@/components/BrandLogo';
import DeleteModal from '@/components/DeleteModal';
import ItemFormModal from '@/components/ItemFormModal';
import type { ItemFormState } from '@/components/ItemFormModal';
import OverviewPage from '@/components/dashboard/OverviewPage';
import ItemDetail from '@/components/dashboard/ItemDetail';
import ProjectsPage from '@/components/projects/ProjectsPage';

import {
  genId,
  loadActiveProject,
  loadDisciplines,
  loadItems,
  loadProjects,
  saveActiveProject,
  saveDisciplines,
  saveItems,
  saveProjects,
} from '@/lib/store';
import { deriveStatus, STATUS_LABELS } from '@/lib/utils';
import type { GroupBy, ItemStatus, MilestoneEntry, PageName, ProcurementItem, Project } from '@/types';

/* ─────────────── helpers ─────────────── */
function buildMilestone(plan: string, fc: string, act: string, note: string): MilestoneEntry {
  return { plan, forecast: fc, actual: act, note };
}

/* ─────────────── MAIN PAGE ─────────────── */
export default function ProcurementApp() {
  const [page, setPage] = useState<PageName>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* ── Data state (Lazily initialized to avoid cascading renders) ── */
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

  const [disciplines, setDisciplines] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    return loadDisciplines();
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

  /* ── Delete modal ── */
  const [deleteOpen, setDeleteOpen]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'item' | 'project'; id: string; name: string;
  } | null>(null);

  /* ── Project create form ── */
  const [pfForm, setPfForm] = useState({
    name: '', client: '', location: '', pic: '', contractNo: '', handover: '',
  });

  /* ── Toast ── */
  const [toast, setToast]           = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Load from localStorage on mount, seed dummy data if empty ── */
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 3000);
  }, []);

  /* ── Derived ── */
  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;
  const projectItems  = activeProject ? items.filter(i => i.projectId === activeProject.id) : items;

  /* ─── Navigation ─── */
  function nav(p: PageName) {
    setPage(p);
    setSidebarOpen(false);
  }

  /* ─── Project CRUD ─── */
  function handleCreateProject() {
    if (!pfForm.name.trim()) { showToast('Project name is required'); return; }
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
    showToast(`Project "${proj.name}" created!`);
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
    showToast('Project deleted.');
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
      showToast('Item updated.');
    } else {
      const newItem: ProcurementItem = {
        ...base, id: genId(), ...derived, createdAt: new Date().toISOString(),
      };
      const updated = [...items, newItem];
      setItems(updated);
      saveItems(updated);
      showToast('Item added.');
    }
    closeItemForm();
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
      showToast('Item deleted.');
      setDeleteOpen(false);
    } else {
      doDeleteProject();
    }
  }

  /* ─── Discipline ─── */
  function addDiscipline() {
    const name = window.prompt('New discipline name:');
    if (!name?.trim()) return;
    const trimmed = name.trim();
    if (disciplines.includes(trimmed)) return;
    const updated = [...disciplines, trimmed];
    setDisciplines(updated);
    saveDisciplines(updated);
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

  const grouped      = groupItems(filteredItems);
  const uniqueVendors = Array.from(new Set(projectItems.map(i => i.vendor).filter(Boolean)));
  const uniqueDiscs   = Array.from(new Set(projectItems.map(i => i.discipline).filter(Boolean)));

  /* ─────── RENDER ─────── */
  if (!isMounted) return null;

  return (
    <>
      {/* Hamburger */}
      <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}>☰</button>

      {/* Sidebar overlay */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="app">
        {/* ── Sidebar ── */}
        <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
          <BrandLogo />
          <div className="nav-section">Menu</div>
          <button
            className={`nav-btn${page === 'overview' || page === 'itemDetail' ? ' active' : ''}`}
            onClick={() => nav('overview')}
          >
            <span className="dot" /> Overview
          </button>
          <button
            className={`nav-btn${page === 'projects' ? ' active' : ''}`}
            onClick={() => nav('projects')}
          >
            <span className="dot" /> Projects
          </button>
        </aside>

        {/* ── Main ── */}
        <main>
          {/* Projects page */}
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

          {/* Overview page */}
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

          {/* Item detail page */}
          {page === 'itemDetail' && detailItem && (
            <section className="page">
              <ItemDetail
                item={detailItem}
                onBack={() => setPage('overview')}
                onEdit={item => openItemForm(item)}
                onDelete={item => confirmDeleteItem(item)}
              />
            </section>
          )}
        </main>
      </div>

      {/* Item form modal */}
      <ItemFormModal
        open={formOpen}
        editingItem={editingItem}
        disciplines={disciplines}
        onClose={closeItemForm}
        onSave={handleSaveItem}
        onAddDiscipline={addDiscipline}
      />

      {/* Delete confirm modal */}
      <DeleteModal
        open={deleteOpen}
        title={deleteTarget?.type === 'project' ? 'Delete Project?' : 'Delete Item?'}
        desc={
          deleteTarget?.type === 'project'
            ? `This will permanently delete "${deleteTarget?.name}" and all its procurement items.`
            : `This will permanently delete "${deleteTarget?.name}".`
        }
        onCancel={() => setDeleteOpen(false)}
        onConfirm={doDelete}
      />

      {/* Toast */}
      <div className={`toast${toastVisible ? ' show' : ''}`}>{toast}</div>
    </>
  );
}
