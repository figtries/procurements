import type { Project, ProcurementItem } from '@/types';

const PROJECTS_KEY = 'figtries_projects';
const ITEMS_KEY = 'figtries_items';
const ACTIVE_PROJECT_KEY = 'figtries_active_project';

export function loadProjects(): Project[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

/**
 * Fill in fields added after an item was first saved, so records written by
 * older builds keep working instead of rendering as `undefined`.
 */
function migrateItem(raw: Partial<ProcurementItem>): ProcurementItem {
  return {
    ...raw,
    readinessDoc: typeof raw.readinessDoc === 'number' ? raw.readinessDoc : 0,
    doNo: raw.doNo ?? '',
    termOfPayment: raw.termOfPayment ?? '',
  } as ProcurementItem;
}

export function loadItems(): ProcurementItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(ITEMS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(migrateItem);
  } catch {
    return [];
  }
}

export function saveItems(items: ProcurementItem[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

export function loadActiveProject(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_PROJECT_KEY);
}

export function saveActiveProject(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (id) {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_PROJECT_KEY);
  }
}

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
