import type { Alert, BoundingBox, Camera, DetectionClass, Severity } from '@/lib/types';
import { DETECTION_CLASSES, ZONE_CLASSES, ZONE_LABELS, formatConfidence } from './taxonomy';
import { SCENES } from './scenes';

// Small deterministic PRNG so seeded history is stable between reloads.
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
const pick = <T,>(rng: Rng, items: T[]) => items[Math.floor(rng() * items.length)];

export function pedestrianBox(x: number, y: number, confidence: number, label = 'Pedestrian (Face Blurred)'): BoundingBox {
  const w = 6;
  const h = 18;
  return {
    x,
    y,
    w,
    h,
    kind: 'pedestrian',
    label,
    confidence,
    faceRegion: { x: x + w / 2, y: y + 2.6, r: 2.2 },
  };
}

// Ambient, anonymous pedestrians drawn on a feed. Positions drift with `tick` so the feed feels live.
export function ambientBoxes(camera: Camera, tick: number): BoundingBox[] {
  if (camera.status === 'offline') return [];
  const scene = SCENES[camera.zone];
  const rng = mulberry32(hash(camera.id));
  const count = Math.min(camera.crowdCount, 7);
  const boxes: BoundingBox[] = [];
  for (let i = 0; i < count; i++) {
    const speed = between(rng, 0.4, 1.2) * (rng() > 0.5 ? 1 : -1);
    const start = between(rng, 0, 100);
    const x = (((start + tick * speed) % 92) + 92) % 92;
    const y = between(rng, scene.ground.yMin, scene.ground.yMax) - 18;
    boxes.push(pedestrianBox(x, y, Number(between(rng, 0.82, 0.97).toFixed(2))));
  }
  return boxes;
}

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function incidentBoxes(camera: Camera, cls: DetectionClass, confidence: number, rng: Rng): BoundingBox[] {
  const scene = SCENES[camera.zone];
  const c = confidence;
  switch (cls) {
    case 'person_fallen': {
      const x = between(rng, 20, 60);
      const y = scene.ground.yMax - 8;
      return [
        {
          x,
          y,
          w: 18,
          h: 9,
          kind: 'pedestrian',
          label: 'Fallen Posture (Face Blurred)',
          confidence: c,
          faceRegion: { x: x + 15.5, y: y + 4, r: 2.2 },
        },
      ];
    }
    case 'ramp_obstructed':
      return [
        { ...scene.ramp, kind: 'hazard', label: 'OKU Ramp Zone', confidence: 0.99 },
        {
          x: scene.ramp.x + 2,
          y: scene.ramp.y + scene.ramp.h * 0.2,
          w: Math.min(22, scene.ramp.w),
          h: scene.ramp.h * 0.7,
          kind: 'vehicle',
          label: 'Vehicle on Ramp (Plate Masked)',
          confidence: c,
        },
      ];
    case 'pipe_leak':
      return [{ ...scene.pipe, kind: 'hazard', label: 'Water Pooling / Leak', confidence: c }];
    case 'bin_overflow':
      return [{ ...scene.bin, kind: 'object', label: 'Bin Overflow', confidence: c }];
    case 'lamp_off':
      return [{ ...scene.lamp, kind: 'object', label: 'Lamp Unlit', confidence: c }];
    case 'crowd_density': {
      const boxes: BoundingBox[] = [];
      const n = 6 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) {
        boxes.push(
          pedestrianBox(
            between(rng, 10, 80),
            between(rng, scene.ground.yMin, scene.ground.yMax) - 18,
            Number(between(rng, 0.8, 0.96).toFixed(2))
          )
        );
      }
      return boxes;
    }
  }
}

function describe(cls: DetectionClass, camera: Camera, count?: number) {
  const where = `${ZONE_LABELS[camera.zone]} · ${camera.location}`;
  switch (cls) {
    case 'person_fallen':
      return `Fallen posture held >10s at ${where}. Check on resident's wellbeing.`;
    case 'ramp_obstructed':
      return `Vehicle blocking the OKU ramp at ${where}. Wheelchair access impeded.`;
    case 'pipe_leak':
      return `Persistent water pooling detected near pipework at ${where}.`;
    case 'bin_overflow':
      return `Refuse above bin rim / spillage at ${where}. Collection needed.`;
    case 'lamp_off':
      return `Lamp unlit during scheduled hours at ${where}.`;
    case 'crowd_density':
      return `Anonymous head-count ${count ?? '?'} exceeds comfortable capacity at ${where}.`;
  }
}

export function buildAlert(
  camera: Camera,
  cls: DetectionClass,
  opts: { rng?: Rng; at?: Date; source?: Alert['source']; severity?: Severity } = {}
): Alert {
  const rng = opts.rng ?? Math.random;
  const floor = Math.max(camera.confidenceThreshold, 0.6);
  const confidence = Number(between(rng, floor, 0.98).toFixed(2));
  const boxes = incidentBoxes(camera, cls, confidence, rng);
  const at = (opts.at ?? new Date()).toISOString();
  const count = cls === 'crowd_density' ? boxes.length + camera.crowdCount : undefined;
  return {
    id: uid('ALR'),
    detectionClass: cls,
    severity: opts.severity ?? DETECTION_CLASSES[cls].defaultSeverity,
    cameraId: camera.id,
    cameraName: camera.name,
    zone: camera.zone,
    message: describe(cls, camera, count),
    confidence,
    createdAt: at,
    status: 'active',
    read: false,
    boxes,
    source: opts.source ?? 'simulated',
    history: [{ at, action: `Detected ${DETECTION_CLASSES[cls].label} (conf ${formatConfidence(confidence)})` }],
  };
}

// Picks a sensible camera + class pair for a random incident.
export function randomIncident(cameras: Camera[], rng: Rng = Math.random, cls?: DetectionClass) {
  const online = cameras.filter(c => c.status === 'online' && (!cls || c.enabledClasses.includes(cls)));
  if (online.length === 0) return null;
  const camera = pick(rng, online);
  const options = camera.enabledClasses.filter(c => ZONE_CLASSES[camera.zone].includes(c));
  const chosen = cls ?? pick(rng, options.length ? options : camera.enabledClasses);
  if (!chosen) return null;
  return { camera, cls: chosen };
}
