import type {
  ItemEvent, ManufacturingProgress, MilestoneEntry, MilestoneKey, ProcurementItem, Project,
} from '@/types';
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

const MFG_NOTES = [
  'Casing selesai, tinggal assembly dan wiring.',
  'Material plat sudah datang, mulai fabrikasi minggu ini.',
  'Menunggu approval drawing revisi 2 sebelum lanjut.',
  '',
  'Produksi jalan sesuai jadwal pabrik.',
];

/**
 * A plan/actual pair for the demo. Items already past FAT are finished by
 * definition; the rest lag their plan by a varying amount, which is what makes
 * the figure worth showing at all.
 */
function mfgFor(n: number, done = false): ManufacturingProgress {
  if (done) return { plan: 1, actual: 1, note: '' };
  const plan = Math.min(1, 0.5 + (n % 5) * 0.12);
  const actual = Math.max(0, plan - (n % 4) * 0.09);
  return {
    plan: Math.round(plan * 100) / 100,
    actual: Math.round(actual * 100) / 100,
    note: MFG_NOTES[n % MFG_NOTES.length],
  };
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

type SeedItem = Omit<ProcurementItem, 'status' | 'progress' | 'events'>;

const SEED: SeedItem[] = [
  {
    id: 'item-001', projectId: pid,
    desc: 'Microturbine Generator Package',
    discipline: 'Mechanical', qty: 2, unit: 'Set',
    vendor: 'PT. Fajar Mas Murni', brand: 'Flex Turbines',
    vendorPic: 'Andi Pratama', vendorPhone: '0811-3400-1200',
    delivery: 'DDP SKN', poNo: 'PO-2401888', poDate: d(-240),
    readinessDoc: 0.85, doNo: '',
    termOfPayment: '30% down payment · 70% after delivery to site',
    statusNote: 'Unit passed FAT, waiting on a shipping slot out of Batam.',
    mfg: mfgFor(1),
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
    vendorPic: 'Rina Kusuma', vendorPhone: '0812-3437-1253',
    delivery: 'CIF Makassar', poNo: 'PO-2401992', poDate: d(-215),
    readinessDoc: 1, doNo: '012/DO/INI/VI/26',
    termOfPayment: '50% down payment · 50% after FAT',
    statusNote: '',
    mfg: mfgFor(2),
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
    vendorPic: 'Dedi Firmansyah', vendorPhone: '0813-3474-1306',
    delivery: 'Ex-works Jakarta', poNo: 'PO-2402100', poDate: d(-200),
    readinessDoc: 0.7, doNo: '',
    termOfPayment: '30% down payment · 60% progress · 10% retention',
    statusNote: 'Fabrication in Cikarang, wiring 70% done.',
    mfg: mfgFor(3),
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
    vendorPic: 'Sari Wulandari', vendorPhone: '0814-3511-1359',
    delivery: 'DDP SKN', poNo: 'PO-2402215', poDate: d(-185),
    readinessDoc: 1, doNo: '045/DO/VM/V/26',
    termOfPayment: '100% after delivery',
    statusNote: 'Material on site, installation 60% complete.',
    mfg: mfgFor(4),
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
    vendorPic: 'Bagus Nugroho', vendorPhone: '0815-3548-1412',
    delivery: 'DDP SKN', poNo: 'PO-2402330', poDate: d(-170),
    readinessDoc: 0.45, doNo: '',
    termOfPayment: '40% down payment · 60% after FAT',
    statusNote: 'FAT postponed — vendor asked to reschedule, no new date yet.',
    mfg: mfgFor(5),
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
    vendorPic: 'Fitri Handayani', vendorPhone: '0816-3585-1465',
    delivery: 'DDP SKN', poNo: 'PO-2402450', poDate: d(-155),
    readinessDoc: 1, doNo: '',
    termOfPayment: '100% after delivery',
    statusNote: '',
    mfg: mfgFor(6),
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
    vendorPic: 'Yusuf Maulana', vendorPhone: '0817-3622-1518',
    delivery: 'Lump Sum', poNo: 'PO-2402560', poDate: d(-145),
    readinessDoc: 0.9, doNo: '',
    termOfPayment: 'Monthly progress payment against signed reports',
    statusNote: 'Foundations complete, steel structure underway.',
    mfg: mfgFor(7),
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
    vendorPic: 'Nadia Safira', vendorPhone: '0818-3659-1571',
    delivery: 'DDP SKN', poNo: 'PO-2402700', poDate: d(-130),
    readinessDoc: 0.95, doNo: '',
    termOfPayment: '25% engineering doc · 50% material · 25% delivery',
    statusNote: 'Final fabrication stage, FAT scheduled this month.',
    mfg: mfgFor(8),
    fat: { plan: d(11), forecast: d(11), actual: '', note: '' },
    rts: { plan: d(32), forecast: '',    actual: '', note: '' },
    mos: { plan: d(54), forecast: '',    actual: '', note: '' },
    createdAt: new Date(Date.now() - 130 * 86400000).toISOString(),
  },
];

/* ═══════════════════════════════════════════════════════════
   Vendor roster — eleven vendors per discipline.
   ═══════════════════════════════════════════════════════════

   The hand-written items above already stand for some of these vendors, so
   the roster is the full list and any row whose vendor is already spoken for
   is skipped. That way "eleven per discipline" is a fact you can read off the
   source instead of a count you have to reconstruct by adding two lists. */

/** vendor · what they supply · brand (blank where the vendor fabricates). */
type RosterRow = readonly [vendor: string, desc: string, brand: string];

const VENDOR_ROSTER: Record<string, readonly RosterRow[]> = {
  Process: [
    ['PT. Tracon Industri', 'Process Package Skid Assembly', ''],
    ['PT. Petrokimia Rekayasa', 'Amine Contactor Package', ''],
    ['PT. Alfa Laval Indonesia', 'Plate Heat Exchanger Train', 'Alfa Laval'],
    ['PT. Sulzer Indonesia', 'Process Column Internals', 'Sulzer'],
    ['PT. Andritz Separation', 'Produced Water Separator', 'Andritz'],
    ['PT. Chemtech Prima', 'Chemical Injection Package', ''],
    ['PT. Nalco Indonesia', 'Corrosion Inhibitor Dosing Unit', 'Nalco'],
    ['PT. Pall Filtration Indonesia', 'Inlet Gas Filter Coalescer', 'Pall'],
    ['PT. Koch Engineering', 'Distillation Tray Package', 'Koch'],
    ['PT. Sarana Proses Utama', 'Flare Knock Out Drum', ''],
    ['PT. Global Process Systems', 'Glycol Regeneration Package', ''],
  ],
  Mechanical: [
    // Already covered by item-001, item-006 and item-008.
    ['PT. Fajar Mas Murni', 'Microturbine Generator Package', 'Flex Turbines'],
    ['PT. Daikin Airconditioning Indonesia', 'HVAC Split System & Ducting', 'Daikin'],
    ['PT. Rekayasa Industri', 'Pressure Vessel & Storage Tank', ''],
    ['PT. Atlas Copco Nusantara', 'Instrument Air Compressor', 'Atlas Copco'],
    ['PT. Flowserve Indonesia', 'Centrifugal Process Pump Set', 'Flowserve'],
    ['PT. SPX Flow Indonesia', 'Booster Pump Skid', 'SPX Flow'],
    ['PT. Grundfos Pompa', 'Utility Water Pump Package', 'Grundfos'],
    ['PT. Kawasaki Machinery', 'Waste Heat Recovery Unit', 'Kawasaki'],
    ['PT. Bumi Kencana Mesindo', 'Diesel Fire Water Pump', ''],
    ['PT. Thermax Indonesia', 'Package Steam Boiler', 'Thermax'],
    ['PT. Konecranes Indonesia', 'Overhead Travelling Crane', 'Konecranes'],
  ],
  Piping: [
    // Already covered by item-004.
    ['PT. Valindo Metalindo', 'Process Piping & Fittings', ''],
    ['PT. Bakrie Pipe Industries', 'Carbon Steel Line Pipe', 'Bakrie'],
    ['PT. Citra Tubindo', 'Seamless Casing & Tubing', 'Citra Tubindo'],
    ['PT. KHI Pipe Industries', 'Spiral Welded Pipe Spools', 'KHI'],
    ['PT. Emerson Valve Indonesia', 'Control Valve Assembly', 'Fisher'],
    ['PT. Velan Valve Indonesia', 'Gate & Globe Valve Package', 'Velan'],
    ['PT. Cameron Systems', 'Ball Valve & Actuator Set', 'Cameron'],
    ['PT. Swagelok Indonesia', 'Tubing & Compression Fittings', 'Swagelok'],
    ['PT. Victaulic Asia', 'Grooved Coupling System', 'Victaulic'],
    ['PT. Pipa Mas Putih', 'Pipe Support & Spring Hanger', ''],
    ['PT. Garlock Sealing Nusantara', 'Spiral Wound Gasket Set', 'Garlock'],
  ],
  Electrical: [
    // Already covered by item-003.
    ['PT. Schneider Electrics Indonesia', 'MCC Panel & Motor Control', 'Schneider Electric'],
    ['PT. ABB Sakti Industri', 'Medium Voltage Switchgear', 'ABB'],
    ['PT. Siemens Indonesia', 'Power Transformer 20 MVA', 'Siemens'],
    ['PT. Trafoindo Prima Perkasa', 'Distribution Transformer', 'Trafoindo'],
    ['PT. Supreme Cable Manufacturing', 'HV & LV Power Cable', 'Sucaco'],
    ['PT. Voksel Electric', 'Instrument & Control Cable', 'Voksel'],
    ['PT. Eaton Electrical Systems', 'UPS & Battery Charger', 'Eaton'],
    ['PT. Legrand Indonesia', 'Cable Tray & Ladder System', 'Legrand'],
    ['PT. Cummins Sales Indonesia', 'Emergency Diesel Generator', 'Cummins'],
    ['PT. Philips Lighting Nusantara', 'Hazardous Area Lighting', 'Signify'],
    ['PT. Erico Indonesia', 'Earthing & Lightning Protection', 'nVent Erico'],
  ],
  Instrument: [
    // Already covered by item-002 and item-005.
    ['PT. Inti Instrumen', 'Gas Chromatograph Analyzer', 'Yokogawa'],
    ['PT. Honeywell Indonesia', 'Safety Instrumented System (SIS)', 'Honeywell'],
    ['PT. Emerson Process Management', 'Coriolis Flow Meter Set', 'Micro Motion'],
    ['PT. Endress Hauser Indonesia', 'Radar Level Transmitter', 'Endress+Hauser'],
    ['PT. Krohne Sistem Indonesia', 'Ultrasonic Flow Meter', 'Krohne'],
    ['PT. Yokogawa Indonesia', 'Distributed Control System', 'Yokogawa'],
    ['PT. Siemens Process Analytics', 'Continuous Gas Analyser', 'Siemens'],
    ['PT. Rotork Controls Indonesia', 'Electric Valve Actuator', 'Rotork'],
    ['PT. Pepperl Fuchs Nusantara', 'Intrinsic Safety Barrier', 'Pepperl+Fuchs'],
    ['PT. WIKA Instrument', 'Pressure Gauge & Thermowell', 'WIKA'],
    ['PT. Draeger Safety Indonesia', 'Gas Detection System', 'Dräger'],
  ],
  Civil: [
    // Already covered by item-007.
    ['PT. Wijaya Karya (Wika)', 'Foundation & Civil Structural Works', ''],
    ['PT. Adhi Karya', 'Site Grading & Earthworks', ''],
    ['PT. Pembangunan Perumahan', 'Control Building Construction', ''],
    ['PT. Waskita Karya', 'Access Road & Hardstanding', ''],
    ['PT. Holcim Beton', 'Ready Mix Concrete Supply', 'Holcim'],
    ['PT. Semen Indonesia Beton', 'Precast Culvert & Drainage', ''],
    ['PT. Wika Beton', 'Spun Pile Foundation', 'Wika Beton'],
    ['PT. Geotekindo Nusantara', 'Soil Improvement Works', ''],
    ['PT. Nindya Karya', 'Perimeter Fence & Gatehouse', ''],
    ['PT. Brantas Abipraya', 'Retaining Wall & Slope Protection', ''],
    ['PT. Jaya Konstruksi', 'Firewater Pond & Basin', ''],
  ],
  Structural: [
    ['PT. Gunung Garuda', 'Structural Steel Fabrication', 'Gunung Steel'],
    ['PT. Krakatau Steel', 'Structural Plate & Section', 'Krakatau'],
    ['PT. Bukaka Teknik Utama', 'Pipe Rack Steel Structure', ''],
    ['PT. Cigading Habeam Centre', 'Welded H-Beam Supply', ''],
    ['PT. Gunanusa Utama Fabricators', 'Equipment Support Frame', ''],
    ['PT. Bangun Sarana Baja', 'Platform & Walkway Grating', ''],
    ['PT. Profab Indonesia', 'Modular Skid Steel Frame', ''],
    ['PT. Alkonusa Teknik', 'Handrail & Stair Assembly', ''],
    ['PT. Jotun Indonesia', 'Structural Painting & Coating', 'Jotun'],
    ['PT. Karya Baja Semesta', 'Anchor Bolt & Base Plate', ''],
    ['PT. Baja Titian Utama', 'Cable Bridge Steel Truss', ''],
  ],
  HSE: [
    ['PT. Tyco Fire Protection', 'Deluge & Sprinkler System', 'Tyco'],
    ['PT. Chubb Fire Security', 'Fire Extinguisher & Hose Reel', 'Chubb'],
    ['PT. Naffco Indonesia', 'Foam Suppression Package', 'Naffco'],
    ['PT. MSA Safety Indonesia', 'Breathing Apparatus Set', 'MSA'],
    ['PT. 3M Indonesia', 'Personal Protective Equipment', '3M'],
    ['PT. Ansell Safety Nusantara', 'Hand & Body Protection', 'Ansell'],
    ['PT. Honeywell Safety Products', 'Fall Arrest & Harness System', 'Miller'],
    ['PT. Detector Indonesia', 'Flame & Smoke Detector Array', 'Det-Tronics'],
    ['PT. Eyewash Sarana Medika', 'Safety Shower & Eyewash Unit', 'Haws'],
    ['PT. Sigma Safety Sign', 'Safety Signage & Marking', ''],
    ['PT. Medivest Nusantara', 'First Aid & Medivac Kit', ''],
  ],
};

/* ── Turning roster rows into items ──

   Each generated item is dealt a schedule profile so the board shows every
   state the app knows how to render rather than eighty rows of "on track".
   Offsets are days from today; `done` is how many milestones already have an
   actual date. Nothing here is random: the same roster always produces the
   same board, so a screenshot taken today matches one taken tomorrow. */
interface Profile {
  fat: number; rts: number; mos: number;
  done: 0 | 1 | 2 | 3;
  /** Days the forecast has slipped past the plan, where it has. */
  slip?: number;
  planning?: boolean;
  note?: string;
}

const PROFILES: readonly Profile[] = [
  { fat: -158, rts: -126, mos: -98, done: 3 },
  { fat: -74,  rts: -41,  mos: 28,  done: 2 },
  { fat: 7,    rts: 36,   mos: 61,  done: 0, note: 'FAT window confirmed with the vendor.' },
  { fat: -19,  rts: 14,   mos: 44,  done: 0, slip: 9, note: 'FAT slipped — vendor shop still occupied.' },
  { fat: 0,    rts: 0,    mos: 0,   done: 0, planning: true, note: 'Awaiting engineering release before scheduling.' },
  { fat: 48,   rts: 79,   mos: 104, done: 0 },
  { fat: -117, rts: -85,  mos: -57, done: 3 },
  { fat: -28,  rts: 11,   mos: 41,  done: 1, note: 'FAT cleared, packing for shipment.' },
  { fat: 12,   rts: 44,   mos: 72,  done: 0, note: 'Kick-off meeting held, drawings under review.' },
  { fat: -132, rts: -97,  mos: -66, done: 3 },
  { fat: -52,  rts: -14,  mos: 33,  done: 2, slip: 6, note: 'Shipment consolidated with an earlier lot.' },
];

/** Contact names for the generated rows. */
const PICS = [
  'Andi Pratama',
  'Rina Kusuma',
  'Dedi Firmansyah',
  'Sari Wulandari',
  'Bagus Nugroho',
  'Fitri Handayani',
  'Yusuf Maulana',
  'Nadia Safira',
  'Hendra Wijaya',
  'Lestari Ayu',
  'Rizky Kurniawan',
  'Maya Anggraini',
] as const;

const UNITS = ['Unit', 'Set', 'Lot', 'Ea', 'Pcs'] as const;
const DELIVERY = ['DDP SKN', 'CIF Makassar', 'Ex-works Jakarta', 'FOB Surabaya', 'Lump Sum'] as const;
const PAYMENT = [
  '30% down payment · 70% after delivery',
  '50% down payment · 50% after FAT',
  '25% engineering doc · 50% material · 25% delivery',
  '100% after delivery',
  '30% down payment · 60% progress · 10% retention',
] as const;

/** A milestone whose plan sits `offset` days out, optionally forecast late. */
function ms(offset: number, done: boolean, slip: number, drift: number): MilestoneEntry {
  const plan = d(offset);
  const forecast = d(offset + slip);
  return {
    plan,
    forecast,
    actual: done ? d(offset + slip + drift) : '',
    note: '',
  };
}

const EMPTY_MS: MilestoneEntry = { plan: '', forecast: '', actual: '', note: '' };
/** Vendors already spoken for by a hand-written item, per discipline. */
const TAKEN = new Set(SEED.map(item => `${item.discipline} ${item.vendor}`));

const GENERATED: SeedItem[] = [];
let seq = 0;

for (const [discipline, rows] of Object.entries(VENDOR_ROSTER)) {
  for (const [vendor, desc, brand] of rows) {
    if (TAKEN.has(`${discipline} ${vendor}`)) continue;

    seq += 1;
    const p = PROFILES[seq % PROFILES.length];
    // A few days of wobble either side, so eleven vendors sharing a profile do
    // not all land on the same calendar day.
    const jitter = (seq * 7) % 9 - 4;
    const slip = p.slip ?? 0;
    const drift = (seq % 5) - 2;
    /* The PO has to predate everything it bought. Picking the age freely used
       to hand a few items a FAT that happened before their own PO — nonsense
       the rule set now refuses, and rightly. */
    const earliest = p.planning ? 0 : Math.min(p.fat + jitter + slip + drift, 0);
    const age = Math.max(120 + ((seq * 13) % 140), -earliest + 30);

    GENERATED.push({
      id: `item-gen-${String(seq).padStart(3, '0')}`,
      projectId: pid,
      desc,
      discipline,
      qty: 1 + (seq % 6),
      unit: UNITS[seq % UNITS.length],
      vendor,
      vendorPic: PICS[seq % PICS.length],
      // A plausible Indonesian mobile, varied per item so the demo does not
      // look like one contact copied across the whole project.
      vendorPhone: `08${11 + (seq % 79)}-${3400 + seq * 37}-${1200 + seq * 53}`.slice(0, 16),
      brand,
      delivery: DELIVERY[seq % DELIVERY.length],
      poNo: `PO-25${String(1000 + seq * 7).padStart(5, '0')}`,
      poDate: d(-age),
      readinessDoc: p.planning ? 0.1 + (seq % 4) * 0.1 : Math.min(1, 0.45 + (seq % 6) * 0.11),
      doNo: p.done === 3 ? `${String(100 + seq)}/DO/${discipline.slice(0, 3).toUpperCase()}/26` : '',
      termOfPayment: PAYMENT[seq % PAYMENT.length],
      statusNote: p.note ?? '',
      mfg: mfgFor(seq, p.done >= 1),
      fat: p.planning ? EMPTY_MS : ms(p.fat + jitter, p.done >= 1, slip, drift),
      rts: p.planning ? EMPTY_MS : ms(p.rts + jitter, p.done >= 2, slip, drift),
      mos: p.planning ? EMPTY_MS : ms(p.mos + jitter, p.done >= 3, slip, drift),
      createdAt: new Date(Date.now() - age * 86400000).toISOString(),
    });
  }
}

/* The demo needs a history to show, and hand-writing one per item would drift
   from the dates above. So the log is reconstructed from the milestones: a
   forecast that sits past its plan was a slip the vendor reported, and an
   actual date was a milestone they closed out. */

const SLIP_REASONS = [
  'Menunggu slot kapal dari Batam.',
  'Komponen impor tertahan di bea cukai.',
  'Antrian produksi di pabrik penuh.',
  'Revisi dokumen desain dari engineering.',
  'Cuaca buruk, pengiriman ditunda.',
];

/** ISO timestamp at midday on `iso`, offset by `days`. */
function stamp(iso: string, days = 0): string {
  const dt = new Date(`${iso}T04:00:00.000Z`);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString();
}

function seedEvents(item: SeedItem, seq: number): ItemEvent[] {
  const events: ItemEvent[] = [];

  for (const key of ['fat', 'rts', 'mos'] as MilestoneKey[]) {
    const ms = item[key];
    if (!ms.plan) continue;

    if (ms.forecast && ms.forecast !== ms.plan) {
      events.push({
        at: stamp(ms.plan, -14),
        source: 'vendor-import',
        actor: item.vendor,
        field: `${key}.forecast`,
        from: ms.plan,
        to: ms.forecast,
        reason: SLIP_REASONS[(seq + key.length) % SLIP_REASONS.length],
      });
    }
    if (ms.actual) {
      events.push({
        at: stamp(ms.actual, 1),
        source: 'vendor-import',
        actor: item.vendor,
        field: `${key}.actual`,
        from: '',
        to: ms.actual,
      });
    }
  }

  if (item.doNo) {
    events.push({
      at: stamp(item.mos.actual || item.mos.plan, 0),
      source: 'vendor-import',
      actor: item.vendor,
      field: 'doNo',
      from: '',
      to: item.doNo,
    });
  }

  events.push({
    at: item.createdAt,
    source: 'created',
    actor: DUMMY_PROJECT.pic,
    field: '',
    from: '',
    to: '',
  });

  return events.sort((a, b) => (a.at < b.at ? 1 : -1));
}

/** Status and progress come from the same rules the app applies to real items. */
export const DUMMY_ITEMS: ProcurementItem[] = [...SEED, ...GENERATED].map((item, index) => {
  /* Once a unit has passed FAT it was, by definition, finished being built.
     Enforcing that here keeps the demo from showing an item at 50% overall
     while claiming it is half manufactured. */
  const withMfg: typeof item = item.fat.actual
    ? { ...item, mfg: { plan: 1, actual: 1, note: '' } }
    : item;

  return {
    ...withMfg,
    events: seedEvents(withMfg, index),
    ...deriveStatus(withMfg as ProcurementItem),
  };
});
