// Seam between the dashboard and the FastAPI + YOLOv8 edge pipeline.
//
// With NEXT_PUBLIC_ANOMALYGUARD_API unset the app runs fully on simulated data.
// Set it (e.g. http://localhost:8000) and the provider will poll
// GET {API}/api/v1/detections?since=<iso> and ingest each payload as an alert.

import type { Alert, BoundingBox, Camera, DetectionClass } from '@/lib/types';
import { buildAlert } from './simulator';

export const API_BASE = process.env.NEXT_PUBLIC_ANOMALYGUARD_API ?? '';
export const isLiveBackend = () => API_BASE.length > 0;

// Evidence snapshot of the frame where a detection opened. The edge service blurs faces in memory before
// encoding it, and sends no image at all if anonymisation fails, so this field is optional.
export type EdgeSnapshot = {
  jpeg_b64: string;
  width: number;
  height: number;
  crop: [number, number, number, number]; // normalised region of the original frame
  regions_blurred: number;
  timings_ms: { people: number; faces: number; blur: number; encode: number; total: number };
};

// Shape the FastAPI service is expected to return. `track_id` is an ephemeral per-session integer,
// never a person identifier.
export type EdgeDetection = {
  camera_id: string;
  class_name: DetectionClass;
  confidence: number;
  timestamp: string;
  boxes: {
    xyxy: [number, number, number, number]; // normalised 0..1
    label: string;
    kind: BoundingBox['kind'];
    confidence: number;
    face_xy_r?: [number, number, number]; // normalised head circle
  }[];
  face_blurred: boolean;
  snapshot?: EdgeSnapshot;
  track_id?: number;
};

export function detectionToAlert(d: EdgeDetection, camera: Camera): Alert {
  const alert = buildAlert(camera, d.class_name, { at: new Date(d.timestamp), source: 'edge' });
  alert.confidence = d.confidence;
  alert.boxes = d.boxes.map(b => ({
    x: b.xyxy[0] * 100,
    y: b.xyxy[1] * 100,
    w: (b.xyxy[2] - b.xyxy[0]) * 100,
    h: (b.xyxy[3] - b.xyxy[1]) * 100,
    kind: b.kind,
    label: b.label,
    confidence: b.confidence,
    faceRegion: b.face_xy_r
      ? { x: b.face_xy_r[0] * 100, y: b.face_xy_r[1] * 100, r: b.face_xy_r[2] * 100 }
      : undefined,
  }));
  return alert;
}

// An evidence snapshot ready to store with a new alert: the anonymised JPEG plus its timing.
export type SnapshotInput = { jpeg: Blob; blurMs?: number; crop?: [number, number, number, number] };

// The detection's snapshot, or null when the edge service sent metadata only.
export function snapshotInput(d: EdgeDetection): SnapshotInput | null {
  if (!d.snapshot) return null;
  try {
    const bytes = Uint8Array.from(atob(d.snapshot.jpeg_b64), c => c.charCodeAt(0));
    return { jpeg: new Blob([bytes], { type: 'image/jpeg' }), blurMs: d.snapshot.timings_ms.total, crop: d.snapshot.crop };
  } catch {
    return null;
  }
}

export async function fetchDetectionsSince(since: string): Promise<EdgeDetection[]> {
  if (!isLiveBackend()) return [];
  const res = await fetch(`${API_BASE}/api/v1/detections?since=${encodeURIComponent(since)}`);
  if (!res.ok) throw new Error(`Detections request failed: ${res.status}`);
  return res.json();
}

// Sandbox upload. The FastAPI side runs YOLOv8 over the clip and returns the same detections, each new
// one with an anonymised evidence snapshot when anonymisation succeeded.
export async function analyseClip(file: File, classes: DetectionClass[], threshold: number): Promise<EdgeDetection[] | null> {
  if (!isLiveBackend()) return null;
  const body = new FormData();
  body.append('file', file);
  body.append('classes', classes.join(','));
  body.append('conf', String(threshold));
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/sandbox/analyse`, { method: 'POST', body });
  } catch {
    throw new Error(`The detection service at ${API_BASE} did not respond. Is the backend running?`);
  }
  if (!res.ok) {
    // FastAPI puts the reason in `detail`, e.g. "Could not decode the video" or "Clip larger than 200 MB".
    const detail = await res.json().then(b => b?.detail, () => undefined);
    throw new Error(typeof detail === 'string' ? detail : `The detection service returned an error (${res.status}).`);
  }
  return res.json();
}
