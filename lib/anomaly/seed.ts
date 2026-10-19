import type {
  Alert,
  AppSettings,
  Asset,
  AuditEntry,
  Camera,
  Contractor,
  Ticket,
  WearEvent,
} from '@/lib/types';
import { DETECTION_CLASSES, ZONE_CLASSES } from './taxonomy';
import { buildAlert, mulberry32, randomIncident } from './simulator';

export const TOWNSHIP = {
  name: 'City of Elmina',
  developer: 'SDP Township',
  subtitle: 'SDP Township · City of Elmina',
};

const camera = (
  id: string,
  name: string,
  zone: Camera['zone'],
  location: string,
  edgeNodeId: string,
  crowdCount: number,
  status: Camera['status'] = 'online'
): Camera => ({
  id,
  name,
  zone,
  location,
  status,
  edgeNodeId,
  enabledClasses: ZONE_CLASSES[zone],
  confidenceThreshold: 0.6,
  inferenceIntervalSec: 2,
  crowdCount,
  lastSeen: new Date().toISOString(),
});

export const SEED_CAMERAS: Camera[] = [
  camera('CAM-01', 'Central Park Jogging Loop', 'jogging_track', 'Elmina Central Park', 'EN-01', 3),
  camera('CAM-02', 'Lakeside Jogging Track', 'jogging_track', 'Elmina Lakeside', 'EN-01', 2),
  camera('CAM-03', 'Precinct 2 Playground', 'playground', 'Elmina Green Precinct 2', 'EN-02', 4),
  camera('CAM-04', 'Block C Bin Bay', 'bin_bay', 'Elmina Valley Block C', 'EN-02', 0),
  camera('CAM-05', 'Main Gate Guardhouse', 'main_gate', 'Persiaran Elmina Gate', 'EN-03', 2),
  camera('CAM-06', 'Community Hall Car Park', 'car_park', 'Elmina Community Hall', 'EN-03', 1),
  camera('CAM-07', 'Shoplot Corridor L1', 'corridor', 'Elmina Commercial Hub', 'EN-04', 3),
  camera('CAM-08', 'Surau Corridor', 'corridor', 'Elmina West Surau', 'EN-04', 1, 'offline'),
];

export const CONTRACTORS: Contractor[] = [
  {
    id: 'cleanco',
    name: 'CleanCo',
    trade: 'Waste & environmental services',
    handles: ['bin_overflow'],
    etaMins: 25,
    hotline: '03-7800 1100',
  },
  {
    id: 'pipefix',
    name: 'PipeFix',
    trade: 'Plumbing & water reticulation',
    handles: ['pipe_leak'],
    etaMins: 40,
    hotline: '03-7800 2200',
  },
  {
    id: 'fixit',
    name: 'FixIt Works',
    trade: 'Civil works & accessibility',
    handles: ['ramp_obstructed'],
    etaMins: 30,
    hotline: '03-7800 3300',
  },
  {
    id: 'electra',
    name: 'Electra Lighting',
    trade: 'Street & common-area lighting',
    handles: ['lamp_off'],
    etaMins: 45,
    hotline: '03-7800 4400',
  },
  {
    id: 'response',
    name: 'Township Response Team',
    trade: 'On-site community wellbeing & crowd marshalling',
    handles: ['person_fallen', 'crowd_density', 'ramp_obstructed'],
    etaMins: 6,
    hotline: '03-7800 9999',
  },
];

export const defaultContractorFor = (cls: Alert['detectionClass']) =>
  CONTRACTORS.find(c => c.handles.includes(cls))?.id ?? 'fixit';

export const SEED_ASSETS: Asset[] = [
  asset('AST-P01', 'Lakeside irrigation main', 'water_pipe', 'Elmina Lakeside', 'CAM-02', '2021-03-01', 240, 88),
  asset('AST-P02', 'Block C refuse-room riser', 'water_pipe', 'Elmina Valley Block C', 'CAM-04', '2019-08-01', 240, 71),
  asset('AST-P03', 'Hall car park drain line', 'water_pipe', 'Elmina Community Hall', 'CAM-06', '2020-01-15', 240, 79),
  asset('AST-P04', 'Shoplot L1 chilled-water line', 'water_pipe', 'Elmina Commercial Hub', 'CAM-07', '2022-06-01', 180, 92),
  asset('AST-L01', 'Central Park LED lamp CP-14', 'street_lamp', 'Elmina Central Park', 'CAM-01', '2020-11-01', 120, 64),
  asset('AST-L02', 'Lakeside LED lamp LS-03', 'street_lamp', 'Elmina Lakeside', 'CAM-02', '2022-02-01', 120, 86),
  asset('AST-L03', 'Gate floodlight G-01', 'street_lamp', 'Persiaran Elmina Gate', 'CAM-05', '2019-05-01', 120, 52),
  asset('AST-L04', 'Car park high-mast CP-A', 'street_lamp', 'Elmina Community Hall', 'CAM-06', '2021-07-01', 120, 74),
  asset('AST-L05', 'Playground lamp PG-02', 'street_lamp', 'Elmina Green Precinct 2', 'CAM-03', '2023-01-01', 120, 93),
  asset('AST-L06', 'Corridor downlights L1', 'street_lamp', 'Elmina Commercial Hub', 'CAM-07', '2022-09-01', 96, 81),
  asset('AST-B01', 'Block C 660L bins (x4)', 'bin', 'Elmina Valley Block C', 'CAM-04', '2023-04-01', 84, 77),
  asset('AST-R01', 'Main gate OKU ramp', 'ramp', 'Persiaran Elmina Gate', 'CAM-05', '2019-05-01', 300, 90),
  asset('AST-R02', 'Hall car park OKU ramp', 'ramp', 'Elmina Community Hall', 'CAM-06', '2020-01-15', 300, 94),
];

function asset(
  id: string,
  name: string,
  type: Asset['type'],
  location: string,
  cameraId: string,
  installedAt: string,
  designLifeMonths: number,
  healthPct: number
): Asset {
  const ageMonths = Math.max(0, (Date.now() - new Date(installedAt).getTime()) / (30.4 * 86400000));
  // Remaining life scales with health so a degraded asset projects an earlier replacement.
  const remainingLifeMonths = Math.max(1, Math.round((designLifeMonths - ageMonths) * (healthPct / 100) + 6));
  return { id, name, type, location, cameraId, installedAt, designLifeMonths, healthPct, remainingLifeMonths };
}

export const DEFAULT_SETTINGS: AppSettings = {
  systemName: 'AnomalyGuard',
  township: TOWNSHIP.subtitle,
  timezone: 'Asia/Kuala_Lumpur',
  snapshotRetentionDays: 30,
  resolvedSnapshotRetentionDays: 7,
  autoSimulate: false,
  simulateEverySec: 20,
  crowdWarningThreshold: 9,
  toastSeverities: ['critical', 'warning'],
  classThresholds: {
    person_fallen: 0.7,
    ramp_obstructed: 0.6,
    pipe_leak: 0.6,
    bin_overflow: 0.55,
    lamp_off: 0.6,
    crowd_density: 0.5,
  },
};

export type AnomalyState = {
  version: number;
  cameras: Camera[];
  alerts: Alert[];
  tickets: Ticket[];
  assets: Asset[];
  wear: WearEvent[];
  audit: AuditEntry[];
  settings: AppSettings;
};

// 2: Privacy Shield toggle replaced by always-anonymised evidence snapshots with retention settings.
export const STATE_VERSION = 2;

// Builds a week of plausible, fully-resolved history so analytics are populated on first load,
// plus a couple of live alerts so the demo opens with something to act on.
export function buildSeedState(): AnomalyState {
  const rng = mulberry32(20261018);
  const now = Date.now();
  const cameras = SEED_CAMERAS.map(c => ({ ...c, enabledClasses: [...c.enabledClasses] }));
  const assets = SEED_ASSETS.map(a => ({ ...a }));
  const alerts: Alert[] = [];
  const tickets: Ticket[] = [];
  const wear: WearEvent[] = [];
  const online = cameras.map(c => ({ ...c, status: 'online' as const }));

  for (let i = 0; i < 46; i++) {
    const hoursAgo = 6 + rng() * 7 * 24;
    const pickResult = randomIncident(online, rng);
    if (!pickResult) continue;
    const at = new Date(now - hoursAgo * 3600000);
    const alert = buildAlert(pickResult.camera, pickResult.cls, { rng, at });
    const contractorId = defaultContractorFor(alert.detectionClass);
    const resolvedAt = new Date(at.getTime() + (20 + rng() * 160) * 60000).toISOString();
    alert.status = 'resolved';
    alert.read = true;
    alert.dispatchedTo = contractorId;
    alert.resolvedAt = resolvedAt;
    alert.history.push(
      { at: new Date(at.getTime() + 3 * 60000).toISOString(), action: `Dispatched to ${nameOf(contractorId)}` },
      { at: resolvedAt, action: 'Resolved on site' }
    );
    const meta = DETECTION_CLASSES[alert.detectionClass];
    if (meta.assetType && rng() > 0.35) {
      const ticket: Ticket = {
        id: `TCK-${String(1000 + tickets.length)}`,
        title: `${meta.label} – ${pickResult.camera.location}`,
        alertId: alert.id,
        detectionClass: alert.detectionClass,
        contractorId,
        status: 'resolved',
        priority: alert.severity,
        location: pickResult.camera.location,
        createdAt: alert.history[1].at,
        startedAt: alert.history[1].at,
        resolvedAt,
        log: [
          { at: alert.history[1].at, action: `Raised from ${alert.id}, assigned to ${nameOf(contractorId)}` },
          { at: resolvedAt, action: 'Work completed' },
        ],
      };
      alert.ticketId = ticket.id;
      tickets.push(ticket);
    }
    const target = meta.assetType
      ? assets.find(a => a.type === meta.assetType && a.cameraId === alert.cameraId)
      : undefined;
    if (target && meta.healthImpactPct) {
      alert.assetId = target.id;
      wear.push({
        id: `WR-${wear.length + 1}`,
        assetId: target.id,
        at: alert.createdAt,
        cause: alert.detectionClass,
        healthDeltaPct: -meta.healthImpactPct,
        lifeDeltaMonths: -(meta.lifeImpactMonths ?? 0),
        note: `${meta.label} flagged by ${alert.cameraId}`,
        alertId: alert.id,
      });
    }
    alerts.push(alert);
  }

  // Live items to open the demo with.
  const gate = cameras.find(c => c.id === 'CAM-05')!;
  const bins = cameras.find(c => c.id === 'CAM-04')!;
  const ramp = buildAlert(gate, 'ramp_obstructed', { rng, at: new Date(now - 4 * 60000) });
  const overflow = buildAlert(bins, 'bin_overflow', { rng, at: new Date(now - 26 * 60000) });
  overflow.status = 'dispatched';
  overflow.dispatchedTo = 'cleanco';
  overflow.read = true;
  overflow.history.push({ at: new Date(now - 22 * 60000).toISOString(), action: 'Dispatched to CleanCo' });
  const liveTicket: Ticket = {
    id: `TCK-${String(1000 + tickets.length)}`,
    title: `Bin Overflow – ${bins.location}`,
    alertId: overflow.id,
    detectionClass: 'bin_overflow',
    contractorId: 'cleanco',
    status: 'in_progress',
    priority: 'warning',
    location: bins.location,
    createdAt: new Date(now - 22 * 60000).toISOString(),
    startedAt: new Date(now - 22 * 60000).toISOString(),
    log: [
      { at: new Date(now - 22 * 60000).toISOString(), action: `Raised from ${overflow.id}, assigned to CleanCo` },
      { at: new Date(now - 20 * 60000).toISOString(), action: 'Crew en route' },
    ],
  };
  overflow.ticketId = liveTicket.id;
  tickets.push(liveTicket);
  alerts.push(overflow, ramp);

  // Apply historical wear on top of the base health so the asset list reflects the log.
  for (const w of wear) {
    const a = assets.find(x => x.id === w.assetId);
    if (!a) continue;
    a.healthPct = Math.max(5, a.healthPct + w.healthDeltaPct / 3);
    a.remainingLifeMonths = Math.max(1, a.remainingLifeMonths + Math.round(w.lifeDeltaMonths / 3));
  }

  alerts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  wear.sort((a, b) => b.at.localeCompare(a.at));

  return {
    version: STATE_VERSION,
    cameras,
    alerts,
    tickets,
    assets: assets.map(a => ({ ...a, healthPct: Math.round(a.healthPct) })),
    wear,
    audit: [
      {
        id: 'AUD-1',
        at: new Date(now - 7 * 86400000).toISOString(),
        actor: 'System',
        text: 'Privacy-by-design defaults applied: evidence snapshots are anonymised at the edge and kept 30 days (7 after resolution).',
      },
    ],
    settings: DEFAULT_SETTINGS,
  };
}

export const nameOf = (contractorId?: string) =>
  CONTRACTORS.find(c => c.id === contractorId)?.name ?? 'Unassigned';
