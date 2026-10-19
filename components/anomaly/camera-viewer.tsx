"use client"

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Power, ShieldCheck } from 'lucide-react';
import type { Camera } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import ZoneFeed, { displayLabel, useCameraFeed } from './zone-feed';
import { SimulateMenu } from './simulate-menu';
import { DETECTION_CLASSES, ZONE_LABELS } from '@/lib/anomaly/taxonomy';
import { SeverityBadge } from './status';

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
  const { cameras, toggleCamera, resolveAlert } = useAnomaly();
  const camera = cameras.find(c => c.id === cameraId)!;
  const { open, ambient } = useCameraFeed(camera);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2 pr-10">
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
          <div className="flex items-start gap-2 rounded-md border bg-muted p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-foreground" aria-hidden />
            Live view is transient and for authorised operators only; it is not recorded. When an alert opens, only an
            evidence snapshot is kept, with faces blurred on the edge node.
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <SimulateMenu cameraId={camera.id} label="Simulate here" />
            <Button size="sm" variant="outline" onClick={() => toggleCamera(camera.id)}>
              <Power className="mr-2 h-4 w-4" aria-hidden />
              {camera.status === 'online' ? 'Take offline' : 'Bring online'}
            </Button>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Active detections ({open.length})</h3>
            {open.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open anomalies on this camera.</p>
            ) : (
              <div className="space-y-2">
                {open.map(a => (
                  <div key={a.id} className="rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={a.severity} />
                      <span className="font-medium">{DETECTION_CLASSES[a.detectionClass].label}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {Math.round(a.confidence * 100)}% confidence · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="h-8" asChild>
                        <Link href={`/dashboard/alerts?focus=${a.id}`}>Open alert</Link>
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => resolveAlert(a.id)}>
                        Resolve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">In frame</h3>
            <div className="flex flex-wrap gap-2">
              {[...open.flatMap(a => a.boxes), ...ambient].slice(0, 10).map((b, i) => (
                <Badge key={i} variant="secondary" className="font-normal">
                  {displayLabel(b, false)}
                </Badge>
              ))}
              {open.length === 0 && ambient.length === 0 && (
                <span className="text-sm text-muted-foreground">Nothing in frame</span>
              )}
            </div>
          </div>

          <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
            <p className="tabular">
              Min. confidence {Math.round(camera.confidenceThreshold * 100)}% · checks every {camera.inferenceIntervalSec} s
            </p>
            <p>Watches for: {camera.enabledClasses.map(c => DETECTION_CLASSES[c].label).join(', ')}</p>
          </div>
        </div>
      </div>
    </>
  );
}
