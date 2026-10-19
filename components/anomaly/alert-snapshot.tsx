"use client"

import { useEffect, useRef, useState } from 'react';
import { Download, ImageOff, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import type { Alert, BoundingBox, Camera } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ZoneScene, displayLabel } from './zone-feed';
import { DETECTION_CLASSES } from '@/lib/anomaly/taxonomy';
import { downloadBlob, getSnapshot, snapshotExpiry } from '@/lib/anomaly/snapshot-store';
import { useAnomaly } from '@/components/providers/anomaly-provider';

// Maps a box in full-frame percentages onto a snapshot that shows only `crop` of the frame.
function inCrop(b: BoundingBox, crop: [number, number, number, number] = [0, 0, 1, 1]): BoundingBox {
  const [cx1, cy1, cx2, cy2] = crop.map(v => v * 100);
  const sx = 100 / (cx2 - cx1);
  const sy = 100 / (cy2 - cy1);
  return { ...b, x: (b.x - cx1) * sx, y: (b.y - cy1) * sy, w: b.w * sx, h: b.h * sy };
}

function Boxes({ alert, crop }: { alert: Alert; crop?: [number, number, number, number] }) {
  const color = DETECTION_CLASSES[alert.detectionClass].color;
  return (
    <>
      {alert.boxes.map(raw => inCrop(raw, crop)).map((b, i) => (
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
              {displayLabel(b, true)}
            </span>
          )}
        </div>
      ))}
    </>
  );
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-MY', { hour12: false });

// The evidence snapshot of the frame where an alert opened. Real snapshots were anonymised on the edge
// node before they reached the browser; opening one here, or exporting it, is written to the audit trail.
export function AlertSnapshot({ alert, camera, audited = false }: { alert: Alert; camera: Camera; audited?: boolean }) {
  const { settings, logSnapshotAccess } = useAnomaly();
  const snapshot = alert.snapshot;
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const logged = useRef(false);

  useEffect(() => {
    if (snapshot?.status !== 'ready') return;
    let cancelled = false;
    let objectUrl: string | null = null;
    getSnapshot(alert.id)
      .then(b => {
        if (cancelled) return;
        if (!b) return setMissing(true);
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
        if (audited && !logged.current) {
          logged.current = true;
          logSnapshotAccess(alert.id, 'viewed');
        }
      })
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [alert.id, snapshot?.status, audited, logSnapshotAccess]);

  const frame = (children: React.ReactNode) => (
    <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">{children}</div>
  );
  const notice = (icon: React.ReactNode, title: string, body: string) =>
    frame(
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-300">
        {icon}
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-md text-xs text-slate-400">{body}</p>
      </div>
    );

  // Simulated alerts have no camera frame: show the reconstructed scene, with heads anonymised.
  if (!snapshot) {
    return frame(
      <>
        <ZoneScene camera={{ ...camera, status: 'online' }} boxes={alert.boxes} active={new Set([alert.detectionClass])} privacy />
        <Boxes alert={alert} />
        <div className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">
          {alert.cameraId} · {fmtDate(alert.createdAt)}
        </div>
        <span className="absolute top-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">Simulated scene</span>
      </>
    );
  }
  if (snapshot.status === 'processing') {
    return notice(
      <Loader2 className="h-6 w-6 animate-spin" />,
      'Anonymising snapshot…',
      'The alert is live already. The snapshot attaches here once the edge node has blurred it.'
    );
  }
  if (snapshot.status === 'deleted') {
    return notice(
      <Trash2 className="h-6 w-6" />,
      'Snapshot deleted under the retention policy',
      `Deleted ${snapshot.deletedAt ? fmtDate(snapshot.deletedAt) : ''}. The alert's metadata and history are kept.`
    );
  }
  if (snapshot.status === 'unavailable' || missing) {
    return notice(
      <ImageOff className="h-6 w-6" />,
      'No snapshot: metadata only',
      'The edge node could not anonymise this frame, so no image was kept. This is by design: it fails closed.'
    );
  }
  if (!url || !blob) return notice(<Loader2 className="h-6 w-6 animate-spin" />, 'Loading snapshot…', '');

  const expiry = snapshotExpiry(alert, settings);
  return (
    <div className="space-y-2">
      {frame(
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Anonymised evidence snapshot for ${alert.id}`} className="absolute inset-0 h-full w-full object-fill" />
          <Boxes alert={alert} crop={snapshot.crop} />
          <div className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">
            {alert.cameraId} · {fmtDate(snapshot.capturedAt)}
          </div>
          <span className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] text-white">
            <ShieldCheck className="h-3 w-3" /> Anonymised at edge
          </span>
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {snapshot.blurMs !== undefined && <>Anonymised in {Math.round(snapshot.blurMs)} ms · </>}
          {expiry && <>Auto-deletes {fmtDate(expiry.toISOString())}</>}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            downloadBlob(`${alert.id}-snapshot.jpg`, blob);
            logSnapshotAccess(alert.id, 'exported');
          }}
        >
          <Download className="h-3.5 w-3.5 mr-1.5" /> Export (logged)
        </Button>
      </div>
    </div>
  );
}
