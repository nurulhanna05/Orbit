// Orbit domain types.
// Everything here describes object states, hazards and anonymous behaviour.
// No type in this file carries identity data (no names, faces, plates or IDs of people).

export type DetectionClass =
  | 'person_fallen'
  | 'ramp_obstructed'
  | 'pipe_leak'
  | 'bin_overflow'
  | 'lamp_off'
  | 'crowd_density';

export type Severity = 'critical' | 'warning' | 'info';

export type ZoneType =
  | 'jogging_track'
  | 'playground'
  | 'bin_bay'
  | 'main_gate'
  | 'car_park'
  | 'corridor';

export type Camera = {
  id: string;
  name: string;
  zone: ZoneType;
  location: string;
  status: 'online' | 'offline';
  edgeNodeId: string;
  enabledClasses: DetectionClass[];
  confidenceThreshold: number; // 0..1
  inferenceIntervalSec: number;
  crowdCount: number; // anonymous head-count estimate, never identities
  lastSeen: string;
};

// Bounding boxes are expressed as percentages of the frame so they scale with any viewer.
export type BoundingBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'pedestrian' | 'vehicle' | 'hazard' | 'object';
  label: string; // anonymous label, e.g. "Pedestrian (Face Blurred)"
  confidence: number;
  faceRegion?: { x: number; y: number; r: number }; // head area, blurred in evidence snapshots
};

export type AlertStatus = 'active' | 'dispatched' | 'resolved';

export type AlertEvent = {
  at: string;
  action: string;
};

// An anonymised evidence snapshot of the frame where an alert opened. Only this metadata lives in app state;
// the JPEG itself is kept in IndexedDB (lib/anomaly/snapshot-store.ts) and deleted under the retention policy.
export type EvidenceSnapshot = {
  status: 'processing' | 'ready' | 'unavailable' | 'deleted';
  capturedAt: string;
  blurMs?: number; // time the edge service spent anonymising the frame
  crop?: [number, number, number, number]; // normalised region of the original frame the image shows
  deletedAt?: string;
};

export type Alert = {
  id: string;
  detectionClass: DetectionClass;
  severity: Severity;
  cameraId: string;
  cameraName: string;
  zone: ZoneType;
  message: string;
  confidence: number;
  createdAt: string;
  status: AlertStatus;
  read: boolean;
  dispatchedTo?: string; // contractor id
  resolvedAt?: string;
  ticketId?: string;
  assetId?: string;
  boxes: BoundingBox[];
  source: 'simulated' | 'sandbox' | 'edge';
  history: AlertEvent[];
  snapshot?: EvidenceSnapshot; // absent on simulated alerts, which have no camera frame
};

// A photo of the site after the repair, attached when a ticket is resolved. Real photos are anonymised by the
// edge service with the same fail-closed blur as evidence snapshots, and the JPEG is kept in IndexedDB under
// the same retention policy. Without a backend the photo is the simulated scene and no image is stored.
export type AfterPhoto = {
  status: 'ready' | 'deleted';
  source: 'edge' | 'simulated';
  capturedAt: string;
  blurMs?: number;
  deletedAt?: string;
};

export type TicketStatus = 'open' | 'in_progress' | 'resolved';

export type Ticket = {
  id: string;
  title: string;
  alertId?: string;
  detectionClass: DetectionClass;
  contractorId: string;
  status: TicketStatus;
  priority: Severity;
  location: string;
  createdAt: string;
  startedAt?: string;
  resolvedAt?: string;
  notes?: string; // resolution notes entered when the ticket is resolved
  afterPhoto?: AfterPhoto;
  log: AlertEvent[];
};

export type Contractor = {
  id: string;
  name: string;
  trade: string;
  handles: DetectionClass[];
  etaMins: number;
  hotline: string;
};

export type AssetType = 'water_pipe' | 'street_lamp' | 'bin' | 'ramp' | 'cctv';

export type Asset = {
  id: string;
  name: string;
  type: AssetType;
  location: string;
  cameraId?: string;
  installedAt: string;
  designLifeMonths: number;
  healthPct: number;
  remainingLifeMonths: number;
};

export type WearEvent = {
  id: string;
  assetId: string;
  at: string;
  cause: DetectionClass | 'repair';
  healthDeltaPct: number; // negative = wear, positive = repair
  lifeDeltaMonths: number;
  note: string;
  alertId?: string;
};

export type AuditEntry = {
  id: string;
  at: string;
  /** Operator who made the change; absent on seeded entries. */
  actor?: string;
  text: string;
};

export type AppSettings = {
  systemName: string;
  township: string;
  timezone: string;
  snapshotRetentionDays: number; // evidence snapshots are deleted this long after capture...
  resolvedSnapshotRetentionDays: number; // ...or this long after their alert is resolved, whichever is sooner
  autoSimulate: boolean;
  simulateEverySec: number;
  crowdWarningThreshold: number;
  toastSeverities: Severity[];
  classThresholds: Record<DetectionClass, number>;
};
