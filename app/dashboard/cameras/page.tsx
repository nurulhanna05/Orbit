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
import { DETECTION_CLASSES, DETECTION_CLASS_LIST, ZONE_LABELS } from '@/lib/anomaly/taxonomy';
import { PageHeader } from '@/components/layout/page-header';
import { SeverityBadge } from '@/components/anomaly/status';

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
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageHeader
        title="Cameras"
        description="Is each camera on and set up right? Switch feeds, tune confidence and interval, and choose what each zone watches for."
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            aria-label="Search cameras"
            placeholder="Search by name, zone or location"
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-10">
              <Filter className="mr-2 h-4 w-4" aria-hidden />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2 min-w-5 justify-center px-1" aria-label={`${activeFilterCount} active`}>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map(camera => {
          const open = openAlerts(camera.id);
          return (
            <Card key={camera.id}>
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>{camera.name}</CardTitle>
                    <CardDescription>
                      {ZONE_LABELS[camera.zone]} · {camera.location}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`sw-${camera.id}`} className="text-xs font-normal text-muted-foreground">
                      {camera.status === 'online' ? 'Online' : 'Offline'}
                    </Label>
                    <Switch id={`sw-${camera.id}`} checked={camera.status === 'online'} onCheckedChange={() => toggleCamera(camera.id)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-2">
                <button
                  className="block w-full overflow-hidden rounded-md"
                  onClick={() => setViewing(camera)}
                  aria-label={`Open the anonymised viewer for ${camera.name}`}
                >
                  <ZoneFeed camera={camera} showLabels={false} />
                </button>
                <div className="flex min-h-6 flex-wrap gap-2">
                  {open.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No open anomalies</span>
                  ) : (
                    open.map(a => (
                      <SeverityBadge key={a.id} severity={a.severity}>
                        {DETECTION_CLASSES[a.detectionClass].label}
                      </SeverityBadge>
                    ))
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="tabular">
                    Min. confidence {Math.round(camera.confidenceThreshold * 100)}% · every {camera.inferenceIntervalSec} s ·{' '}
                    {camera.enabledClasses.length} classes
                  </span>
                  <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => setConfiguring(camera.id)}>
                    <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden />
                    Configure
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {visible.length === 0 && <p className="text-sm text-muted-foreground">No cameras match these filters.</p>}
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
                  <Label id="conf-label">Minimum confidence</Label>
                  <span className="text-sm tabular">{Math.round(camera.confidenceThreshold * 100)}%</span>
                </div>
                <Slider
                  aria-labelledby="conf-label"
                  min={0.3}
                  max={0.95}
                  step={0.05}
                  value={[camera.confidenceThreshold]}
                  onValueChange={([v]) => updateCamera(camera.id, { confidenceThreshold: Number(v.toFixed(2)) })}
                />
                <p className="text-xs text-muted-foreground">Detections below this confidence are discarded on the edge.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="interval">How often to check</Label>
                <Select
                  value={String(camera.inferenceIntervalSec)}
                  onValueChange={v => updateCamera(camera.id, { inferenceIntervalSec: Number(v) })}
                >
                  <SelectTrigger id="interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVALS.map(i => (
                      <SelectItem key={i} value={String(i)}>
                        Every {i} s
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium leading-none">What this camera watches for</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {DETECTION_CLASS_LIST.map(cls => {
                    const checked = camera.enabledClasses.includes(cls.id);
                    return (
                      <label key={cls.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm hover:bg-accent">
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
                          <span className="block text-xs text-muted-foreground">{cls.description}</span>
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
