"use client"

import { Activity, Battery, Cpu, Radio, Router, Server, Thermometer, Video, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { EDGE_NODES, IOT_SENSORS, SENSOR_LABELS, SERVICES, jitter } from '@/lib/anomaly/infrastructure';
import { ZONE_LABELS } from '@/lib/anomaly/taxonomy';
import { PageHeader } from '@/components/layout/page-header';
import { StatTile } from '@/components/anomaly/stat-tile';
import { StatusBadge as ToneBadge } from '@/components/anomaly/status';

type Status = 'healthy' | 'warning' | 'critical';

const STATUS_LABEL: Record<Status, string> = { healthy: 'Healthy', warning: 'Warning', critical: 'Critical' };

function StatusBadge({ status }: { status: Status }) {
  return <ToneBadge tone={status === 'healthy' ? 'success' : status}>{STATUS_LABEL[status]}</ToneBadge>;
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
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageHeader
        title="Edge & IoT Health"
        description="Is the infrastructure behind AnomalyGuard healthy? Edge inference nodes, camera feeds, IoT sensors and services."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Summary icon={Video} label="Camera feeds" value={`${online} of ${cameras.length} online`} status={camerasStatus} />
        <Summary icon={Cpu} label="Edge nodes" value={`${nodes.filter(n => n.status === 'healthy').length} of ${nodes.length} healthy`} status={nodesStatus} />
        <Summary icon={Radio} label="IoT sensors" value={`${sensors.filter(s => s.status === 'healthy').length} of ${sensors.length} in range`} status={sensorsStatus} />
        <Summary icon={Server} label="Lowest service uptime, 30 days" value={`${uptime}%`} status={uptime < 99.8 ? 'warning' : 'healthy'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-4 w-4" aria-hidden /> Edge inference nodes
          </CardTitle>
          <CardDescription>
            YOLOv8 runs on-site; faces are blurred on the node so raw identities never reach the cloud.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {nodes.map(n => (
            <div key={n.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">
                    {n.id} <span className="font-normal text-muted-foreground">· {n.site}</span>
                  </h3>
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
                  <Thermometer className="h-4 w-4" aria-hidden /> <span className="tabular">{n.tempC}°C</span>
                </p>
                <p className="flex items-center gap-1">
                  <Activity className="h-4 w-4" aria-hidden /> <span className="tabular">{n.fps}</span> frames per second per feed
                </p>
              </div>
              <div className="space-y-2">
                {n.attached.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                    <span>
                      <span className="font-mono">{c.id}</span> {c.name}{' '}
                      <span className="text-muted-foreground">({ZONE_LABELS[c.zone]})</span>
                    </span>
                    <Switch
                      checked={c.status === 'online'}
                      onCheckedChange={() => toggleCamera(c.id)}
                      aria-label={`${c.name} feed ${c.status === 'online' ? 'online' : 'offline'}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Router className="h-4 w-4" aria-hidden /> IoT sensors
            </CardTitle>
            <CardDescription>Complements vision with direct telemetry for pipes, lighting and bins.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">Sensor</th>
                  <th className="p-3 font-medium">Site</th>
                  <th className="p-3 text-right font-medium">Reading</th>
                  <th className="p-3 font-medium">Healthy range</th>
                  <th className="p-3 font-medium">Battery</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {sensors.map(s => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="p-3">
                      <p className="text-xs font-medium">{SENSOR_LABELS[s.kind]}</p>
                      <p className="font-mono text-xs text-muted-foreground">{s.id}</p>
                    </td>
                    <td className="p-3 text-xs">{s.site}</td>
                    <td className="p-3 text-right text-xs font-medium tabular">
                      {s.value} {s.unit}
                      {s.outOfRange && <span className="block font-normal text-muted-foreground">out of range</span>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground tabular">
                      {s.min}–{s.max} {s.unit}
                    </td>
                    <td className="p-3 text-xs">
                      <span className="flex items-center gap-1 tabular">
                        <Battery className="h-4 w-4" aria-hidden /> {s.battery}%{s.battery < 20 && ' (low)'}
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
              <Server className="h-4 w-4" aria-hidden /> Services
            </CardTitle>
            <CardDescription>Uptime over 30 days and median response time</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {SERVICES.map(s => (
              <div key={s.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{s.name}</span>
                  <span className="font-medium tabular">{s.uptime30d}%</span>
                </div>
                <Progress value={(s.uptime30d - 99) * 100} aria-label={`${s.name} uptime`} />
                <p className="text-xs text-muted-foreground tabular">{s.latencyMs} ms median response</p>
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
        <span className="tabular">{value}%</span>
      </div>
      <Progress value={value} aria-label={label} />
    </div>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
  status,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  status: Status;
}) {
  return (
    <StatTile icon={Icon} label={label} value={value}>
      <div className="mt-2">
        <StatusBadge status={status} />
      </div>
    </StatTile>
  );
}
