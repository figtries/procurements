import type { ProcurementItem, Project } from '@/types';
import { deriveStatus } from './procurement';

/* Seed data for a fresh install.
   Dates are generated relative to today so the demo keeps reading sensibly
   instead of drifting into "everything is two years late". */

/** ISO date `offset` days from today. */
function d(offset: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + offset);
  return dt.toISOString().slice(0, 10);
}

export const DUMMY_PROJECT: Project = {
  id: 'demo-proj-001',
  name: 'Pulau Gading BCS Phase 1',
  client: 'PT. Energi Nusantara',
  location: 'Sulawesi Tengah',
  pic: 'Budi Santoso',
  contractNo: 'CTR-2024-0088',
  handover: d(150),
  createdAt: new Date(Date.now() - 300 * 86400000).toISOString(),
  revision: 6,
};

const pid = DUMMY_PROJECT.id;

type SeedItem = Omit<ProcurementItem, 'status' | 'progress'>;

const SEED: SeedItem[] = [
  {
    id: 'item-001', projectId: pid,
    desc: 'Microturbine Generator Package',
    discipline: 'Mechanical', qty: 2, unit: 'Set',
    vendor: 'PT. Fajar Mas Murni', brand: 'Flex Turbines',
    delivery: 'DDP SKN', poNo: 'PO-2401888', poDate: d(-240),
    readinessDoc: 0.85, doNo: '',
    termOfPayment: '30% down payment · 70% after delivery to site',
    statusNote: 'Unit passed FAT, waiting on a shipping slot out of Batam.',
    fat: { plan: d(-95),  forecast: d(-95), actual: d(-92), note: 'FAT completed with a minor punch list.' },
    rts: { plan: d(-40),  forecast: d(-40), actual: d(-36), note: '' },
    mos: { plan: d(9),    forecast: d(19),  actual: '',     note: 'Awaiting customs clearance.' },
    createdAt: new Date(Date.now() - 240 * 86400000).toISOString(),
  },
  {
    id: 'item-002', projectId: pid,
    desc: 'Gas Chromatograph Analyzer',
    discipline: 'Instrument', qty: 1, unit: 'Unit',
    vendor: 'PT. Inti Instrumen', brand: 'Yokogawa',
    delivery: 'CIF Makassar', poNo: 'PO-2401992', poDate: d(-215),
    readinessDoc: 1, doNo: '012/DO/INI/VI/26',
    termOfPayment: '50% down payment · 50% after FAT',
    statusNote: '',
    fat: { plan: d(-120), forecast: d(-120), actual: d(-122), note: '' },
    rts: { plan: d(-88),  forecast: d(-88),  actual: d(-88),  note: '' },
    mos: { plan: d(-62),  forecast: d(-62),  actual: d(-63),  note: '' },
    createdAt: new Date(Date.now() - 215 * 86400000).toISOString(),
  },
  {
    id: 'item-003', projectId: pid,
    desc: 'MCC Panel & Motor Control',
    discipline: 'Electrical', qty: 1, unit: 'Lot',
    vendor: 'PT. Schneider Electrics Indonesia', brand: 'Schneider Electric',
    delivery: 'Ex-works Jakarta', poNo: 'PO-2402100', poDate: d(-200),
    readinessDoc: 0.7, doNo: '',
    termOfPayment: '30% down payment · 60% progress · 10% retention',
    statusNote: 'Fabrication in Cikarang, wiring 70% done.',
    fat: { plan: d(26), forecast: d(26), actual: '', note: '' },
    rts: { plan: d(47), forecast: '',    actual: '', note: '' },
    mos: { plan: d(66), forecast: '',    actual: '', note: '' },
    createdAt: new Date(Date.now() - 200 * 86400000).toISOString(),
  },
  {
    id: 'item-004', projectId: pid,
    desc: 'Process Piping & Fittings',
    discipline: 'Piping', qty: 1, unit: 'Lot',
    vendor: 'PT. Valindo Metalindo', brand: '',
    delivery: 'DDP SKN', poNo: 'PO-2402215', poDate: d(-185),
    readinessDoc: 1, doNo: '045/DO/VM/V/26',
    termOfPayment: '100% after delivery',
    statusNote: 'Material on site, installation 60% complete.',
    fat: { plan: d(-135), forecast: d(-135), actual: d(-137), note: '' },
    rts: { plan: d(-112), forecast: d(-112), actual: d(-110), note: '' },
    mos: { plan: d(-90),  forecast: d(-90),  actual: d(-91),  note: '' },
    createdAt: new Date(Date.now() - 185 * 86400000).toISOString(),
  },
  {
    id: 'item-005', projectId: pid,
    desc: 'Safety Instrumented System (SIS)',
    discipline: 'Instrument', qty: 1, unit: 'Set',
    vendor: 'PT. Honeywell Indonesia', brand: 'Honeywell',
    delivery: 'DDP SKN', poNo: 'PO-2402330', poDate: d(-170),
    readinessDoc: 0.45, doNo: '',
    termOfPayment: '40% down payment · 60% after FAT',
    statusNote: 'FAT postponed — vendor asked to reschedule, no new date yet.',
    fat: { plan: d(-30), forecast: d(-8), actual: '', note: 'Vendor site not ready.' },
    rts: { plan: d(-5),  forecast: '',    actual: '', note: '' },
    mos: { plan: d(20),  forecast: '',    actual: '', note: '' },
    createdAt: new Date(Date.now() - 170 * 86400000).toISOString(),
  },
  {
    id: 'item-006', projectId: pid,
    desc: 'HVAC Split System & Ducting',
    discipline: 'Mechanical', qty: 4, unit: 'Unit',
    vendor: 'PT. Daikin Airconditioning Indonesia', brand: 'Daikin',
    delivery: 'DDP SKN', poNo: 'PO-2402450', poDate: d(-155),
    readinessDoc: 1, doNo: '',
    termOfPayment: '100% after delivery',
    statusNote: '',
    fat: { plan: d(-100), forecast: d(-100), actual: d(-101), note: '' },
    rts: { plan: d(-75),  forecast: d(-75),  actual: d(-74),  note: '' },
    mos: { plan: d(-50),  forecast: d(-50),  actual: d(-51),  note: '' },
    createdAt: new Date(Date.now() - 155 * 86400000).toISOString(),
  },
  {
    id: 'item-007', projectId: pid,
    desc: 'Foundation & Civil Structural Works',
    discipline: 'Civil', qty: 1, unit: 'Lot',
    vendor: 'PT. Wijaya Karya (Wika)', brand: '',
    delivery: 'Lump Sum', poNo: 'PO-2402560', poDate: d(-145),
    readinessDoc: 0.9, doNo: '',
    termOfPayment: 'Monthly progress payment against signed reports',
    statusNote: 'Foundations complete, steel structure underway.',
    fat: { plan: '',      forecast: '', actual: '', note: '' },
    rts: { plan: '',      forecast: '', actual: '', note: '' },
    mos: { plan: d(104),  forecast: '', actual: '', note: '' },
    createdAt: new Date(Date.now() - 145 * 86400000).toISOString(),
  },
  {
    id: 'item-008', projectId: pid,
    desc: 'Pressure Vessel & Storage Tank',
    discipline: 'Mechanical', qty: 3, unit: 'Unit',
    vendor: 'PT. Rekayasa Industri', brand: '',
    delivery: 'DDP SKN', poNo: 'PO-2402700', poDate: d(-130),
    readinessDoc: 0.95, doNo: '',
    termOfPayment: '25% engineering doc · 50% material · 25% delivery',
    statusNote: 'Final fabrication stage, FAT scheduled this month.',
    fat: { plan: d(11), forecast: d(11), actual: '', note: '' },
    rts: { plan: d(32), forecast: '',    actual: '', note: '' },
    mos: { plan: d(54), forecast: '',    actual: '', note: '' },
    createdAt: new Date(Date.now() - 130 * 86400000).toISOString(),
  },
];

/** Status and progress come from the same rules the app applies to real items. */
export const DUMMY_ITEMS: ProcurementItem[] = SEED.map(item => ({
  ...item,
  ...deriveStatus(item as ProcurementItem),
}));
