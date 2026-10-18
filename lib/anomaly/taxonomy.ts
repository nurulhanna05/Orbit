import type { AssetType, DetectionClass, Severity, ZoneType } from '@/lib/types';

export type DetectionClassMeta = {
  id: DetectionClass;
  label: string;
  description: string;
  defaultSeverity: Severity;
  // Which asset type wears when this class is flagged, and by how much.
  assetType?: AssetType;
  healthImpactPct?: number;
  lifeImpactMonths?: number;
  // Hex colour used for boxes and charts.
  color: string;
};

export const DETECTION_CLASSES: Record<DetectionClass, DetectionClassMeta> = {
  person_fallen: {
    id: 'person_fallen',
    label: 'Person Fallen',
    description: 'Posture-based fall detection (skeleton keypoints, no identity).',
    defaultSeverity: 'critical',
    color: '#6250d6',
  },
  ramp_obstructed: {
    id: 'ramp_obstructed',
    label: 'Ramp Obstructed',
    description: 'Vehicle or object blocking a wheelchair/OKU ramp.',
    defaultSeverity: 'warning',
    assetType: 'ramp',
    healthImpactPct: 1,
    lifeImpactMonths: 0,
    color: '#eb6834',
  },
  pipe_leak: {
    id: 'pipe_leak',
    label: 'Pipe Leak',
    description: 'Water pooling or spray near pipes and fittings.',
    defaultSeverity: 'critical',
    assetType: 'water_pipe',
    healthImpactPct: 12,
    lifeImpactMonths: 9,
    color: '#2a78d6',
  },
  bin_overflow: {
    id: 'bin_overflow',
    label: 'Bin Overflow',
    description: 'Waste above bin rim or spilled around the bin bay.',
    defaultSeverity: 'warning',
    assetType: 'bin',
    healthImpactPct: 3,
    lifeImpactMonths: 1,
    color: '#e87ba4',
  },
  lamp_off: {
    id: 'lamp_off',
    label: 'Lamp Off',
    description: 'Street or corridor lamp not lit during scheduled hours.',
    defaultSeverity: 'warning',
    assetType: 'street_lamp',
    healthImpactPct: 8,
    lifeImpactMonths: 6,
    color: '#eda100',
  },
  crowd_density: {
    id: 'crowd_density',
    label: 'Crowd Density',
    description: 'Anonymous head-count and flow above zone capacity.',
    defaultSeverity: 'info',
    color: '#1baf7a',
  },
};

export const DETECTION_CLASS_LIST = Object.values(DETECTION_CLASSES);

export const SEVERITY_META: Record<Severity, { label: string; badge: string; dot: string; rank: number }> = {
  critical: {
    label: 'Critical',
    badge: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900',
    dot: 'bg-red-500',
    rank: 0,
  },
  warning: {
    label: 'Warning',
    badge: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
    dot: 'bg-amber-500',
    rank: 1,
  },
  info: {
    label: 'Info',
    badge: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900',
    dot: 'bg-sky-500',
    rank: 2,
  },
};

export const ZONE_LABELS: Record<ZoneType, string> = {
  jogging_track: 'Jogging Track',
  playground: 'Playground',
  bin_bay: 'Bin Bay',
  main_gate: 'Main Gate',
  car_park: 'Car Park',
  corridor: 'Corridor',
};

// Which classes make sense in which zone (used by the simulator and default camera config).
export const ZONE_CLASSES: Record<ZoneType, DetectionClass[]> = {
  jogging_track: ['person_fallen', 'lamp_off', 'crowd_density', 'pipe_leak'],
  playground: ['person_fallen', 'crowd_density', 'lamp_off'],
  bin_bay: ['bin_overflow', 'pipe_leak', 'lamp_off'],
  main_gate: ['ramp_obstructed', 'crowd_density', 'lamp_off'],
  car_park: ['ramp_obstructed', 'lamp_off', 'pipe_leak'],
  corridor: ['person_fallen', 'pipe_leak', 'lamp_off', 'crowd_density'],
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  water_pipe: 'Water Pipe',
  street_lamp: 'Street Lamp',
  bin: 'Refuse Bin',
  ramp: 'OKU Ramp',
  cctv: 'Camera',
};

export const formatConfidence = (c: number) => c.toFixed(2);
