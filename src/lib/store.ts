import type { Project, ProcurementItem } from '@/types';

const PROJECTS_KEY = 'figtries_projects';
const ITEMS_KEY = 'figtries_items';
const DISCIPLINES_KEY = 'figtries_disciplines';
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

export function loadItems(): ProcurementItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(ITEMS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveItems(items: ProcurementItem[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

export function loadDisciplines(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(DISCIPLINES_KEY);
    if (stored) return JSON.parse(stored);
    return ['Instrument', 'Electrical', 'Mechanical', 'Civil', 'Piping', 'HVAC'];
  } catch {
    return ['Instrument', 'Electrical', 'Mechanical', 'Civil', 'Piping', 'HVAC'];
  }
}

export function saveDisciplines(disciplines: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DISCIPLINES_KEY, JSON.stringify(disciplines));
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
