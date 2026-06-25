export type ItemStatus = 'planning' | 'ontrack' | 'atrisk' | 'late' | 'onsite';

export interface MilestoneEntry {
  plan: string;
  forecast: string;
  actual: string;
  note: string;
}

export interface ProcurementItem {
  id: string;
  projectId: string;
  desc: string;
  discipline: string;
  qty: number;
  unit: string;
  vendor: string;
  brand: string;
  delivery: string;
  poNo: string;
  poDate: string;
  statusNote: string;
  fat: MilestoneEntry;
  rts: MilestoneEntry;
  mos: MilestoneEntry;
  status: ItemStatus;
  progress: number;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  location: string;
  pic: string;
  contractNo: string;
  handover: string;
  createdAt: string;
}

export type GroupBy = 'discipline' | 'status' | 'vendor';

export type PageName = 'overview' | 'projects' | 'itemDetail';
