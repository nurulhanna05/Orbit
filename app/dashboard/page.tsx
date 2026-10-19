"use client"

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, Camera as CameraIcon, Gauge, OctagonAlert, Ticket, TriangleAlert } from 'lucide-react';
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
import { PageHeader } from '@/components/layout/page-header';
import { StatTile } from '@/components/anomaly/stat-tile';
import { SeverityBadge } from '@/components/anomaly/status';
import { AssetHealthTicker, healthTone } from '@/components/anomaly/asset-ticker';
import { DETECTION_CLASSES, SEVERITY_META } from '@/lib/anomaly/taxonomy';
import { nameOf } from '@/lib/anomaly/seed';

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
    <div className="mx-auto max-w-[1600px] space-y-4">
      <PageHeader
        title="Township Operations Overview"
        description="What needs attention right now, without watching who anyone is."
        actions={
          <>
            <div className="flex items-center gap-2">
              <Switch id="auto-sim" checked={settings.autoSimulate} onCheckedChange={v => updateSettings({ autoSimulate: v })} />
              <Label htmlFor="auto-sim" className="text-sm font-normal">
                Auto-simulate every {settings.simulateEverySec}s
              </Label>
            </div>
            <ResetDemoButton variant="ghost" size="sm" />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatTile
          href="/dashboard/alerts"
          icon={OctagonAlert}
          iconClassName={critical ? 'text-critical-fg' : undefined}
          label="Critical open"
          value={critical}
          tone={critical ? 'text-critical-fg' : undefined}
        />
        <StatTile
          href="/dashboard/alerts"
          icon={TriangleAlert}
          iconClassName={warnings ? 'text-warning-fg' : undefined}
          label="Warnings open"
          value={warnings}
          tone={warnings ? 'text-warning-fg' : undefined}
        />
        <StatTile href="/dashboard/tickets" icon={Ticket} label="Open work orders" value={openTickets.length} />
        <StatTile href="/dashboard/cameras" icon={CameraIcon} label="Feeds online" value={`${online} of ${cameras.length}`} />
        <StatTile href="/dashboard/assets" icon={Gauge} label="Average asset health" value={`${avgHealth}%`} tone={healthTone(avgHealth)} />
      </div>

      <AssetHealthTicker />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="flex flex-col xl:max-h-[560px]">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 p-4 pb-2">
            <div>
              <CardTitle>Open anomalies</CardTitle>
              <CardDescription>
                {open.length} awaiting action or in the field · {last24.length} detected in the last 24 hours
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/alerts">
                Alert centre <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 pt-2">
            {open.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">All clear across the township.</p>
            ) : (
              <ul className="divide-y">
                {open.slice(0, 8).map(a => (
                  <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={a.severity} />
                        <span className="text-sm font-medium">{DETECTION_CLASSES[a.detectionClass].label}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {a.cameraName} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                        {a.dispatchedTo && ` · ${nameOf(a.dispatchedTo)} dispatched`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {a.ticketId ? (
                        <Badge variant="outline">Ticket {a.ticketId}</Badge>
                      ) : (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => createTicketFromAlert(a.id)}>
                          Raise ticket
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => resolveAlert(a.id)}>
                        Resolve
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 p-4 pb-2">
            <div>
              <CardTitle>Zones needing attention</CardTitle>
              <CardDescription>Select a feed to open the anonymised viewer</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/cameras/live">
                All zones <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 pt-2 sm:grid-cols-2">
            {featured.map(c => (
              <button
                key={c.id}
                className="rounded-md text-left"
                onClick={() => setViewing(c)}
                aria-label={`Open the anonymised viewer for ${c.name}`}
              >
                <ZoneFeed camera={c} className="rounded-md" />
                <p className="mt-1 text-sm font-medium">{c.name}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <CameraViewerDialog camera={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
