// AnomalyGuard domain types.
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
  faceRegion?: { x: number; y: number; r: number }; // area that is blurred when the Privacy Shield is on
};

export type AlertStatus = 'active' | 'dispatched' | 'resolved';

export type AlertEvent = {
  at: string;
  action: string;
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
  privacyShield: boolean;
  autoSimulate: boolean;
  simulateEverySec: number;
  crowdWarningThreshold: number;
  toastSeverities: Severity[];
  classThresholds: Record<DetectionClass, number>;
};
