"use client"

import type { Alert, Camera } from '@/lib/types';
import { ZoneScene, displayLabel } from './zone-feed';
import { DETECTION_CLASSES } from '@/lib/anomaly/taxonomy';
import { ShieldCheck } from 'lucide-react';

// The frame captured when an alert fired: only that alert's boxes. Faces were blurred on the edge node
// before the frame was stored, so the snapshot stays anonymised whatever the live Privacy Shield setting is.
export function AlertSnapshot({ alert, camera }: { alert: Alert; camera: Camera }) {
  const privacy = true;
  const color = DETECTION_CLASSES[alert.detectionClass].color;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
      <ZoneScene
        camera={{ ...camera, status: 'online' }}
        boxes={alert.boxes}
        active={new Set([alert.detectionClass])}
        privacy={privacy}
      />
      {alert.boxes.map((b, i) => (
        <div
          key={i}
          className="absolute border-2 rounded-[2px]"
          style={{
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: `${b.w}%`,
            height: `${b.h}%`,
            borderColor: b.kind === 'pedestrian' && alert.detectionClass === 'crowd_density' ? '#1baf7a' : color,
          }}
        >
          {(alert.boxes.length < 4 || i === 0) && (
            <span
              className="absolute left-[-2px] bottom-full whitespace-nowrap rounded-t-[2px] px-1 py-0.5 text-[11px] font-medium text-white"
              style={{ backgroundColor: color }}
            >
              {displayLabel(b, privacy)}
            </span>
          )}
        </div>
      ))}
      <div className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">
        {alert.cameraId} · {new Date(alert.createdAt).toLocaleString('en-MY', { hour12: false })}
      </div>
      <span className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] text-white">
        <ShieldCheck className="h-3 w-3" /> Anonymised at edge
      </span>
    </div>
  );
}
