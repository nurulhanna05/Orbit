// Seam between the dashboard and the FastAPI + YOLOv8 edge pipeline.
//
// With NEXT_PUBLIC_ANOMALYGUARD_API unset the app runs fully on simulated data.
// Set it (e.g. http://localhost:8000) and the provider will poll
// GET {API}/api/v1/detections?since=<iso> and ingest each payload as an alert.

import type { Alert, BoundingBox, Camera, DetectionClass } from '@/lib/types';
import { buildAlert } from './simulator';

export const API_BASE = process.env.NEXT_PUBLIC_ANOMALYGUARD_API ?? '';
export const isLiveBackend = () => API_BASE.length > 0;

// Shape the FastAPI service is expected to return. Faces are blurred on the edge node before
// anything leaves it; `track_id` is an ephemeral per-session integer, never a person identifier.
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
    face_xy_r?: [number, number, number]; // normalised blur circle
  }[];
  face_blurred: boolean;
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

export async function fetchDetectionsSince(since: string): Promise<EdgeDetection[]> {
  if (!isLiveBackend()) return [];
  const res = await fetch(`${API_BASE}/api/v1/detections?since=${encodeURIComponent(since)}`);
  if (!res.ok) throw new Error(`Detections request failed: ${res.status}`);
  return res.json();
}

// Sandbox upload. The FastAPI side should run YOLOv8 over the clip and return the same detections.
export async function analyseClip(file: File, classes: DetectionClass[], threshold: number): Promise<EdgeDetection[] | null> {
  if (!isLiveBackend()) return null;
  const body = new FormData();
  body.append('file', file);
  body.append('classes', classes.join(','));
  body.append('conf', String(threshold));
  const res = await fetch(`${API_BASE}/api/v1/sandbox/analyse`, { method: 'POST', body });
  if (!res.ok) throw new Error(`Sandbox analysis failed: ${res.status}`);
  return res.json();
}
