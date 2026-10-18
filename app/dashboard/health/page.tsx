"use client"

import { Activity, Battery, Cpu, Radio, Router, Server, Thermometer, Video } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { EDGE_NODES, IOT_SENSORS, SENSOR_LABELS, SERVICES, jitter } from '@/lib/anomaly/infrastructure';
import { ZONE_LABELS } from '@/lib/anomaly/taxonomy';
import { cn } from '@/lib/utils';

type Status = 'healthy' | 'warning' | 'critical';

const STATUS_BADGE: Record<Status, string> = {
  healthy: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};

function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant="outline" className={cn('capitalize', STATUS_BADGE[status])}>
      {status}
    </Badge>
  );
}

export default function HealthPage() {
  const { cameras, tick, toggleCamera } = useAnomaly();

  const nodes = EDGE_NODES.map((n, i) => {
    const attached = cameras.filter(c => c.edgeNodeId === n.id);
    const offline = attached.filter(c => c.status === 'offline').length;
    const tempC = jitter(n.tempC, tick, i, 2);
    const status: Status = offline === attached.length && attached.length > 0 ? 'critical' : offline > 0 || tempC > 65 ? 'warning' : 'healthy';
    return {
      ...n,
      attached,
      offline,
      status,
      tempC,
      cpu: Math.round(jitter(n.cpu, tick, i, 6)),
      gpu: Math.round(jitter(n.gpu, tick, i + 1, 6)),
      fps: Math.round(jitter(n.fps, tick, i + 2, 1.5)),
    };
  });

  const sensors = IOT_SENSORS.map((s, i) => {
    const value = jitter(s.value, tick, i + 3, s.kind === 'bin_fill' ? 2 : s.max * 0.01);
    const outOfRange = value < s.min || value > s.max;
    const status: Status = outOfRange ? 'warning' : s.battery < 20 ? 'warning' : 'healthy';
    return { ...s, value, outOfRange, status };
  });

  const online = cameras.filter(c => c.status === 'online').length;
  const camerasStatus: Status = online === cameras.length ? 'healthy' : online / cameras.length < 0.6 ? 'critical' : 'warning';
  const nodesStatus: Status = nodes.some(n => n.status === 'critical') ? 'critical' : nodes.some(n => n.status === 'warning') ? 'warning' : 'healthy';
  const sensorsStatus: Status = sensors.some(s => s.status !== 'healthy') ? 'warning' : 'healthy';
  const uptime = Math.min(...SERVICES.map(s => s.uptime30d));

  return (
    <div className="container mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edge &amp; IoT Health</h1>
        <p className="text-muted-foreground">
          Uptime of the infrastructure that powers AnomalyGuard: edge inference nodes, camera feeds, IoT sensors and services.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Summary icon={Video} label="Camera feeds" value={`${online}/${cameras.length} online`} status={camerasStatus} />
        <Summary icon={Cpu} label="Edge nodes" value={`${nodes.filter(n => n.status === 'healthy').length}/${nodes.length} healthy`} status={nodesStatus} />
        <Summary icon={Radio} label="IoT sensors" value={`${sensors.filter(s => s.status === 'healthy').length}/${sensors.length} nominal`} status={sensorsStatus} />
        <Summary icon={Server} label="Lowest service uptime (30d)" value={`${uptime}%`} status={uptime < 99.8 ? 'warning' : 'healthy'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" /> Edge inference nodes
          </CardTitle>
          <CardDescription>
            YOLOv8 runs on-site; faces are blurred on the node so raw identities never reach the cloud.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {nodes.map(n => (
            <div key={n.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {n.id} <span className="font-normal text-muted-foreground">· {n.site}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {n.hardware} · <code>{n.model}</code> · up {n.uptimeDays}d
                  </p>
                </div>
                <StatusBadge status={n.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Meter label="CPU" value={n.cpu} />
                <Meter label="GPU / TPU" value={n.gpu} />
                <p className="flex items-center gap-1">
                  <Thermometer className="h-3.5 w-3.5" /> {n.tempC}°C
                </p>
                <p className="flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5" /> {n.fps} fps per feed
                </p>
              </div>
              <div className="space-y-1.5">
                {n.attached.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                    <span>
                      <span className="font-mono">{c.id}</span> {c.name}{' '}
                      <span className="text-muted-foreground">({ZONE_LABELS[c.zone]})</span>
                    </span>
                    <Switch checked={c.status === 'online'} onCheckedChange={() => toggleCamera(c.id)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Router className="h-5 w-5" /> IoT sensors
            </CardTitle>
            <CardDescription>Complements vision with direct telemetry for pipes, lighting and bins.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">Sensor</th>
                  <th className="p-3 font-medium">Site</th>
                  <th className="p-3 font-medium text-right">Reading</th>
                  <th className="p-3 font-medium">Healthy range</th>
                  <th className="p-3 font-medium">Battery</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {sensors.map(s => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="p-3">
                      <p className="font-medium text-xs">{SENSOR_LABELS[s.kind]}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{s.id}</p>
                    </td>
                    <td className="p-3 text-xs">{s.site}</td>
                    <td className={cn('p-3 text-right tabular-nums text-xs font-medium', s.outOfRange && 'text-amber-600')}>
                      {s.value} {s.unit}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {s.min}–{s.max} {s.unit}
                    </td>
                    <td className="p-3 text-xs">
                      <span className={cn('flex items-center gap-1', s.battery < 20 && 'text-red-600')}>
                        <Battery className="h-3.5 w-3.5" /> {s.battery}%
                      </span>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" /> Services
            </CardTitle>
            <CardDescription>30-day uptime and median latency</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {SERVICES.map(s => (
              <div key={s.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{s.name}</span>
                  <span className="tabular-nums font-medium">{s.uptime30d}%</span>
                </div>
                <Progress value={(s.uptime30d - 99) * 100} className="h-1.5" />
                <p className="text-[11px] text-muted-foreground">{s.latencyMs} ms median latency</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
  status,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  status: Status;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </p>
        <p className="text-lg font-bold tabular-nums">{value}</p>
        <StatusBadge status={status} />
      </CardContent>
    </Card>
  );
}
