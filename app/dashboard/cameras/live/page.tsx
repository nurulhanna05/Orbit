"use client";

import { useState } from 'react';
import { Grid2X2, Grid3X3, Maximize2 } from 'lucide-react';
import type { Camera, ZoneType } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import ZoneFeed from '@/components/anomaly/zone-feed';
import { CameraViewerDialog } from '@/components/anomaly/camera-viewer';
import { SimulateMenu } from '@/components/anomaly/simulate-menu';
import { PrivacyStatusBadge } from '@/components/anomaly/privacy-shield';
import { DETECTION_CLASSES, SEVERITY_META, ZONE_LABELS } from '@/lib/anomaly/taxonomy';

export default function LiveZonesPage() {
  const { cameras, alerts } = useAnomaly();
  const [layout, setLayout] = useState<'2x2' | '3x3'>('3x3');
  const [zone, setZone] = useState<ZoneType | 'all'>('all');
  const [viewing, setViewing] = useState<Camera | null>(null);

  const zones = Array.from(new Set(cameras.map(c => c.zone)));
  const visible = cameras.filter(c => zone === 'all' || c.zone === zone);
  const openFor = (id: string) => alerts.filter(a => a.cameraId === id && a.status !== 'resolved');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Live Zones</h1>
          <p className="text-muted-foreground text-sm">
            Multi-feed view of township zones. Boxes describe object states and anonymous behaviour, never who someone is.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrivacyStatusBadge compact />
          <SimulateMenu />
          <Button variant="outline" size="icon" onClick={() => setLayout(layout === '2x2' ? '3x3' : '2x2')} title="Toggle grid">
            {layout === '2x2' ? <Grid3X3 className="h-4 w-4" /> : <Grid2X2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Tabs value={zone} onValueChange={v => setZone(v as ZoneType | 'all')}>
        <TabsList className="h-auto flex-wrap justify-start">
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
              <button className="group relative block w-full text-left" onClick={() => setViewing(camera)}>
                <ZoneFeed camera={camera} />
                <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <Maximize2 className="h-3.5 w-3.5" />
                </span>
              </button>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{camera.name}</p>
                    <p className="text-xs text-muted-foreground">{camera.location}</p>
                  </div>
                  <SimulateMenu cameraId={camera.id} size="icon" variant="ghost" />
                </div>
                <div className="mt-2 flex flex-wrap gap-1 min-h-[22px]">
                  {open.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {camera.status === 'online' ? 'All clear' : 'Camera offline'}
                    </span>
                  ) : (
                    open.map(a => (
                      <Badge key={a.id} variant="outline" className={`text-[10px] ${SEVERITY_META[a.severity].badge}`}>
                        {DETECTION_CLASSES[a.detectionClass].label}
                      </Badge>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 text-center">
          <Stat label="Feeds" value={cameras.length} />
          <Stat label="Online" value={cameras.filter(c => c.status === 'online').length} />
          <Stat label="Open anomalies" value={alerts.filter(a => a.status !== 'resolved').length} />
          <Stat
            label="Anonymous head-count"
            value={cameras.filter(c => c.status === 'online').reduce((n, c) => n + c.crowdCount, 0)}
          />
        </CardContent>
      </Card>

      <CameraViewerDialog camera={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
