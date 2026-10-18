"use client"

import { useState } from 'react';
import { Filter, Search, SlidersHorizontal } from 'lucide-react';
import type { Camera } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import ZoneFeed from '@/components/anomaly/zone-feed';
import { CameraViewerDialog } from '@/components/anomaly/camera-viewer';
import { DETECTION_CLASS_LIST, SEVERITY_META, ZONE_LABELS } from '@/lib/anomaly/taxonomy';

const INTERVALS = [1, 2, 5, 10, 30];

export default function CamerasPage() {
  const { cameras, alerts, toggleCamera } = useAnomaly();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ showOffline: true, onlyWarnings: false, onlyCritical: false });
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Camera | null>(null);

  const openAlerts = (id: string) => alerts.filter(a => a.cameraId === id && a.status !== 'resolved');
  const activeFilterCount = Number(!filters.showOffline) + Number(filters.onlyWarnings) + Number(filters.onlyCritical);

  const visible = cameras.filter(c => {
    const open = openAlerts(c.id);
    if (!filters.showOffline && c.status === 'offline') return false;
    if (filters.onlyWarnings && !open.some(a => a.severity !== 'info')) return false;
    if (filters.onlyCritical && !open.some(a => a.severity === 'critical')) return false;
    const q = query.toLowerCase();
    return !q || [c.name, c.location, c.id, ZONE_LABELS[c.zone]].some(s => s.toLowerCase().includes(q));
  });

  return (
    <div className="container mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cameras</h1>
        <p className="text-muted-foreground">
          Toggle feeds, tune confidence thresholds and inference intervals, and choose which anomaly classes each zone watches.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, zone or location…" className="pl-8" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-10">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 justify-center">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Filter cameras</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={filters.showOffline} onCheckedChange={v => setFilters(f => ({ ...f, showOffline: v }))}>
              Show offline cameras
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={filters.onlyWarnings} onCheckedChange={v => setFilters(f => ({ ...f, onlyWarnings: v }))}>
              Only with open warnings
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={filters.onlyCritical} onCheckedChange={v => setFilters(f => ({ ...f, onlyCritical: v }))}>
              Only with critical alerts
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visible.map(camera => {
          const open = openAlerts(camera.id);
          return (
            <Card key={camera.id} className={camera.status === 'offline' ? 'opacity-80' : undefined}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{camera.name}</CardTitle>
                    <CardDescription>
                      {ZONE_LABELS[camera.zone]} · {camera.location}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`sw-${camera.id}`} className="text-xs text-muted-foreground">
                      {camera.status === 'online' ? 'Online' : 'Offline'}
                    </Label>
                    <Switch id={`sw-${camera.id}`} checked={camera.status === 'online'} onCheckedChange={() => toggleCamera(camera.id)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <button className="block w-full overflow-hidden rounded-md" onClick={() => setViewing(camera)}>
                  <ZoneFeed camera={camera} showLabels={false} />
                </button>
                <div className="flex flex-wrap gap-1">
                  {open.length === 0 ? (
                    <Badge variant="outline" className="text-[10px]">No open anomalies</Badge>
                  ) : (
                    open.map(a => (
                      <Badge key={a.id} variant="outline" className={`text-[10px] ${SEVERITY_META[a.severity].badge}`}>
                        {SEVERITY_META[a.severity].label}: {a.detectionClass}
                      </Badge>
                    ))
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    conf ≥ {camera.confidenceThreshold.toFixed(2)} · every {camera.inferenceIntervalSec}s · {camera.enabledClasses.length} classes
                  </span>
                  <Button size="sm" variant="outline" className="h-7" onClick={() => setConfiguring(camera.id)}>
                    <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                    Configure
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {visible.length === 0 && <p className="text-muted-foreground text-sm">No cameras match these filters.</p>}
      </div>

      <CameraConfigDialog cameraId={configuring} onClose={() => setConfiguring(null)} />
      <CameraViewerDialog camera={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function CameraConfigDialog({ cameraId, onClose }: { cameraId: string | null; onClose: () => void }) {
  const { cameras, updateCamera } = useAnomaly();
  const camera = cameras.find(c => c.id === cameraId);

  return (
    <Dialog open={!!camera} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg">
        {camera && (
          <>
            <DialogHeader>
              <DialogTitle>Configure {camera.name}</DialogTitle>
              <DialogDescription>Changes apply immediately to the edge node {camera.edgeNodeId}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Confidence threshold</Label>
                  <span className="text-sm font-mono">{camera.confidenceThreshold.toFixed(2)}</span>
                </div>
                <Slider
                  min={0.3}
                  max={0.95}
                  step={0.05}
                  value={[camera.confidenceThreshold]}
                  onValueChange={([v]) => updateCamera(camera.id, { confidenceThreshold: Number(v.toFixed(2)) })}
                />
                <p className="text-xs text-muted-foreground">Detections below this confidence are discarded on the edge.</p>
              </div>
              <div className="space-y-2">
                <Label>Inference interval</Label>
                <Select
                  value={String(camera.inferenceIntervalSec)}
                  onValueChange={v => updateCamera(camera.id, { inferenceIntervalSec: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVALS.map(i => (
                      <SelectItem key={i} value={String(i)}>
                        Every {i}s
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Detection classes</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DETECTION_CLASS_LIST.map(cls => {
                    const checked = camera.enabledClasses.includes(cls.id);
                    return (
                      <label key={cls.id} className="flex items-start gap-2 rounded-md border p-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={v =>
                            updateCamera(camera.id, {
                              enabledClasses: v
                                ? [...camera.enabledClasses, cls.id]
                                : camera.enabledClasses.filter(c => c !== cls.id),
                            })
                          }
                        />
                        <span>
                          <span className="font-medium">{cls.label}</span>
                          <code className="block text-[10px] text-muted-foreground">{cls.id}</code>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
