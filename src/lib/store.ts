import type { Project, ProcurementItem } from '@/types';

const PROJECTS_KEY = 'figtries_projects';
const ITEMS_KEY = 'figtries_items';
const ACTIVE_PROJECT_KEY = 'figtries_active_project';
const SEED_VERSION_KEY = 'figtries_seed_version';

/**
 * Bump whenever the demo data in `dummyData.ts` changes.
 *
 * Without this the seed is written exactly once, on the first visit, and every
 * later change to it is invisible to anyone who has already opened the app —
 * the browser keeps handing back the rows it saved months ago and the new data
 * never gets a chance to load.
 */
export const SEED_VERSION = '4-mfg-contact-and-rule-clean';

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
    vendorPic: raw.vendorPic ?? '',
    vendorPhone: raw.vendorPhone ?? '',
    mfg: raw.mfg ?? { plan: 0, actual: 0, note: '' },
    events: Array.isArray(raw.events) ? raw.events : [],
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

/** Seed rows are the ones written by `dummyData.ts`; `genId()` never makes these. */
function isSeedItem(item: ProcurementItem): boolean {
  return item.id.startsWith('item-');
}

/**
 * Bring a browser that already holds an older demo up to the current one.
 *
 * Only rows that came from a previous seed are replaced. Anything typed into
 * this browser is kept and moved to the front, which is the difference between
 * refreshing the demo and wiping someone's work.
 */
export function reconcileSeed(
  stored: ProcurementItem[],
  seed: ProcurementItem[],
): ProcurementItem[] {
  if (typeof window === 'undefined') return stored;
  if (localStorage.getItem(SEED_VERSION_KEY) === SEED_VERSION) return stored;

  const own = stored.filter(item => !isSeedItem(item));
  const next = [...own, ...seed];
  saveItems(next);
  localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
  return next;
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
