"use client"

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, Camera as CameraIcon, Gauge, ShieldCheck, Siren, Ticket, TriangleAlert } from 'lucide-react';
import type { Camera } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { ResetDemoButton } from '@/components/anomaly/reset-demo-button';
import ZoneFeed from '@/components/anomaly/zone-feed';
import { CameraViewerDialog } from '@/components/anomaly/camera-viewer';
import { SimulateMenu } from '@/components/anomaly/simulate-menu';
import { AssetHealthTicker, healthTone } from '@/components/anomaly/asset-ticker';
import { DETECTION_CLASSES, DETECTION_CLASS_LIST, SEVERITY_META } from '@/lib/anomaly/taxonomy';
import { nameOf } from '@/lib/anomaly/seed';
import { cn } from '@/lib/utils';

export default function OverviewPage() {
  const { alerts, tickets, cameras, assets, settings, updateSettings, resolveAlert, createTicketFromAlert } = useAnomaly();
  const [viewing, setViewing] = useState<Camera | null>(null);

  const open = alerts
    .filter(a => a.status !== 'resolved')
    .sort((a, b) => SEVERITY_META[a.severity].rank - SEVERITY_META[b.severity].rank || b.createdAt.localeCompare(a.createdAt));
  const critical = open.filter(a => a.severity === 'critical').length;
  const warnings = open.filter(a => a.severity === 'warning').length;
  const openTickets = tickets.filter(t => t.status !== 'resolved');
  const online = cameras.filter(c => c.status === 'online').length;
  const avgHealth = Math.round(assets.reduce((n, a) => n + a.healthPct, 0) / Math.max(1, assets.length));
  const dayAgo = Date.now() - 86400000;
  const last24 = alerts.filter(a => new Date(a.createdAt).getTime() > dayAgo);

  // Feeds with open anomalies first, so the overview always shows what needs attention.
  const featured = [...cameras]
    .sort((a, b) => {
      const score = (c: Camera) =>
        open.filter(x => x.cameraId === c.id).reduce((n, x) => n + 3 - SEVERITY_META[x.severity].rank, 0) + (c.status === 'online' ? 0.5 : 0);
      return score(b) - score(a);
    })
    .slice(0, 4);

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{settings.township}</p>
          <h1 className="text-3xl font-bold tracking-tight">Township Operations Overview</h1>
          <p className="text-muted-foreground">
            Situational awareness and predictive maintenance for community spaces, without watching who anyone is.
          </p>
        </div>
        <SimulateMenu variant="default" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
        <ShieldCheck className="h-8 w-8 shrink-0 text-emerald-600" />
        <div className="flex-1">
          <p className="font-semibold">Evidence snapshots are always anonymised.</p>
          <p className="text-sm text-muted-foreground">
            Privacy-by-design, aligned with PDPA principles. AnomalyGuard classifies object states, hazards and anonymous
            behaviour, with no facial recognition or identity tracking. Live view is transient and for authorised
            operators only.
          </p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Kpi href="/dashboard/alerts" icon={Siren} label="Critical open" value={critical} tone={critical ? 'text-red-600' : undefined} />
        <Kpi href="/dashboard/alerts" icon={TriangleAlert} label="Warnings open" value={warnings} tone={warnings ? 'text-amber-600' : undefined} />
        <Kpi href="/dashboard/tickets" icon={Ticket} label="Open work orders" value={openTickets.length} />
        <Kpi href="/dashboard/cameras" icon={CameraIcon} label="Feeds online" value={`${online}/${cameras.length}`} />
        <Kpi href="/dashboard/assets" icon={Gauge} label="Avg asset health" value={`${avgHealth}%`} tone={healthTone(avgHealth)} />
      </div>

      <AssetHealthTicker />

      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Zones needing attention</CardTitle>
              <CardDescription>Click a feed to open the anonymised viewer</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/cameras/live">
                All zones <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {featured.map(c => (
              <button key={c.id} className="text-left" onClick={() => setViewing(c)}>
                <ZoneFeed camera={c} className="rounded-md" />
                <p className="mt-1 text-xs font-medium">{c.name}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Open anomalies</CardTitle>
              <CardDescription>{open.length} awaiting action or in the field</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/alerts">
                Alert centre <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[460px] overflow-y-auto">
            {open.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">All clear across the township.</p>}
            {open.slice(0, 8).map(a => (
              <div key={a.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className={cn('h-2 w-2 rounded-full', SEVERITY_META[a.severity].dot)} />
                    {DETECTION_CLASSES[a.detectionClass].label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {a.cameraName} · conf {a.confidence.toFixed(2)}
                  {a.dispatchedTo && ` · ${nameOf(a.dispatchedTo)} dispatched`}
                </p>
                <div className="mt-2 flex gap-2">
                  {a.ticketId ? (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {a.ticketId}
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => createTicketFromAlert(a.id)}>
                      Raise ticket
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => resolveAlert(a.id)}>
                    Resolve
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Last 24 hours by class</CardTitle>
            <CardDescription>
              {last24.length} detections ·{' '}
              <Link href="/dashboard/analytics" className="underline">
                full analytics
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {DETECTION_CLASS_LIST.map(c => {
              const n = last24.filter(a => a.detectionClass === c.id).length;
              return (
                <div key={c.id} className="rounded-md border p-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
                    {c.label}
                  </p>
                  <p className="text-2xl font-bold tabular-nums">{n}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Demo controls</CardTitle>
            <CardDescription>Run the full flow without a live YOLOv8 backend</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="auto-sim" className="text-sm">
                Auto-generate incidents every {settings.simulateEverySec}s
              </Label>
              <Switch id="auto-sim" checked={settings.autoSimulate} onCheckedChange={v => updateSettings({ autoSimulate: v })} />
            </div>
            <SimulateMenu label="Trigger one incident" />
            <ResetDemoButton variant="ghost" size="sm" className="w-full text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <CameraViewerDialog camera={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function Kpi({
  href,
  icon: Icon,
  label,
  value,
  tone,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5" /> {label}
          </p>
          <p className={cn('mt-1 text-2xl font-bold tabular-nums', tone)}>{value}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
