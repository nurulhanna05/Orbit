"use client"

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Power, ShieldCheck, ShieldOff } from 'lucide-react';
import type { Camera } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import ZoneFeed, { displayLabel, useCameraFeed } from './zone-feed';
import { SimulateMenu } from './simulate-menu';
import { DETECTION_CLASSES, SEVERITY_META, ZONE_LABELS } from '@/lib/anomaly/taxonomy';

export function CameraViewerDialog({ camera, onClose }: { camera: Camera | null; onClose: () => void }) {
  return (
    <Dialog open={!!camera} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto">
        {camera && <CameraViewerBody cameraId={camera.id} />}
      </DialogContent>
    </Dialog>
  );
}

function CameraViewerBody({ cameraId }: { cameraId: string }) {
  const { cameras, settings, toggleCamera, resolveAlert } = useAnomaly();
  const camera = cameras.find(c => c.id === cameraId)!;
  const { open, ambient } = useCameraFeed(camera);
  const privacy = settings.privacyShield;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {camera.name}
          <Badge variant="outline" className="font-mono">{camera.id}</Badge>
        </DialogTitle>
        <DialogDescription>
          {ZONE_LABELS[camera.zone]} · {camera.location} · edge node {camera.edgeNodeId}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-2">
          <ZoneFeed camera={camera} large className="rounded-md" />
          <div
            className={
              privacy
                ? 'flex items-center gap-2 rounded-md bg-emerald-50 p-2 text-xs text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                : 'flex items-center gap-2 rounded-md bg-red-50 p-2 text-xs text-red-900 dark:bg-red-950/50 dark:text-red-200'
            }
          >
            {privacy ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
            {privacy
              ? 'Blur patches cover every face region. Stored frames are anonymised on the edge node. Plates are masked.'
              : 'Privacy Shield is off: un-blurred live view for verification only. It is not recorded, and the change is in the PDPA audit trail.'}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <SimulateMenu cameraId={camera.id} label="Simulate here" />
            <Button size="sm" variant="outline" onClick={() => toggleCamera(camera.id)}>
              <Power className="h-4 w-4 mr-1.5" />
              {camera.status === 'online' ? 'Take offline' : 'Bring online'}
            </Button>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Active detections ({open.length})
            </p>
            {open.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open anomalies on this camera.</p>
            ) : (
              <div className="space-y-2">
                {open.map(a => (
                  <div key={a.id} className="rounded-md border p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DETECTION_CLASSES[a.detectionClass].color }} />
                        {DETECTION_CLASSES[a.detectionClass].label}
                      </span>
                      <Badge variant="outline" className={SEVERITY_META[a.severity].badge}>
                        {SEVERITY_META[a.severity].label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      conf {a.confidence.toFixed(2)} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="secondary" className="h-7 text-xs" asChild>
                        <Link href={`/dashboard/alerts?focus=${a.id}`}>Open alert</Link>
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => resolveAlert(a.id)}>
                        Resolve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Frame labels</p>
            <div className="flex flex-wrap gap-1">
              {[...open.flatMap(a => a.boxes), ...ambient].slice(0, 10).map((b, i) => (
                <Badge key={i} variant="secondary" className="font-normal text-[11px]">
                  {displayLabel(b, privacy)}
                </Badge>
              ))}
              {open.length === 0 && ambient.length === 0 && (
                <span className="text-sm text-muted-foreground">Nothing in frame</span>
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
            <p>
              Threshold {camera.confidenceThreshold.toFixed(2)} · inference every {camera.inferenceIntervalSec}s
            </p>
            <p>Classes: {camera.enabledClasses.map(c => DETECTION_CLASSES[c].label).join(', ')}</p>
          </div>
        </div>
      </div>
    </>
  );
}
