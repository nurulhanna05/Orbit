"use client";

import { useState } from 'react';
import { Grid2X2, Grid3X3, Maximize2 } from 'lucide-react';
import type { Camera, ZoneType } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import ZoneFeed from '@/components/anomaly/zone-feed';
import { CameraViewerDialog } from '@/components/anomaly/camera-viewer';
import { SimulateMenu } from '@/components/anomaly/simulate-menu';
import { PageHeader } from '@/components/layout/page-header';
import { SeverityBadge } from '@/components/anomaly/status';
import { DETECTION_CLASSES, ZONE_LABELS } from '@/lib/anomaly/taxonomy';

export default function LiveZonesPage() {
  const { cameras, alerts } = useAnomaly();
  const [layout, setLayout] = useState<'2x2' | '3x3'>('3x3');
  const [zone, setZone] = useState<ZoneType | 'all'>('all');
  const [viewing, setViewing] = useState<Camera | null>(null);

  const zones = Array.from(new Set(cameras.map(c => c.zone)));
  const visible = cameras.filter(c => zone === 'all' || c.zone === zone);
  const openFor = (id: string) => alerts.filter(a => a.cameraId === id && a.status !== 'resolved');
  const online = cameras.filter(c => c.status === 'online');

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
      <PageHeader
        title="Live Zones"
        description={
          <>
            What is happening in each zone right now? Boxes describe object states and anonymous behaviour, never who
            someone is.{' '}
            <span className="tabular">
              {online.length} of {cameras.length} feeds online · {alerts.filter(a => a.status !== 'resolved').length} open
              anomalies · {online.reduce((n, c) => n + c.crowdCount, 0)} people counted anonymously.
            </span>
          </>
        }
        actions={
          <Button
            variant="outline"
            size="icon"
            onClick={() => setLayout(layout === '2x2' ? '3x3' : '2x2')}
            aria-label={layout === '2x2' ? 'Show three feeds per row' : 'Show two feeds per row'}
          >
            {layout === '2x2' ? <Grid3X3 className="h-4 w-4" aria-hidden /> : <Grid2X2 className="h-4 w-4" aria-hidden />}
          </Button>
        }
      />

      <Tabs value={zone} onValueChange={v => setZone(v as ZoneType | 'all')}>
        <TabsList className="h-auto flex-wrap justify-start" aria-label="Filter by zone">
          <TabsTrigger value="all">All zones</TabsTrigger>
          {zones.map(z => (
            <TabsTrigger key={z} value={z}>
              {ZONE_LABELS[z]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className={`grid gap-4 ${layout === '2x2' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
        {visible.map(camera => {
          const open = openFor(camera.id);
          return (
            <Card key={camera.id} className="overflow-hidden">
              <button
                className="group relative block w-full text-left"
                onClick={() => setViewing(camera)}
                aria-label={`Open the anonymised viewer for ${camera.name}`}
              >
                <ZoneFeed camera={camera} />
                <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Maximize2 className="h-4 w-4" aria-hidden />
                </span>
              </button>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">{camera.name}</h2>
                    <p className="text-xs text-muted-foreground">{camera.location}</p>
                  </div>
                  <SimulateMenu cameraId={camera.id} size="icon" variant="ghost" label={`Simulate an incident on ${camera.name}`} />
                </div>
                <div className="mt-2 flex min-h-6 flex-wrap gap-2">
                  {open.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {camera.status === 'online' ? 'All clear' : 'Camera offline'}
                    </span>
                  ) : (
                    open.map(a => (
                      <SeverityBadge key={a.id} severity={a.severity}>
                        {DETECTION_CLASSES[a.detectionClass].label}
                      </SeverityBadge>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CameraViewerDialog camera={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
