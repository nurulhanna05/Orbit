"use client"

import { useState } from 'react';
import Link from 'next/link';
import { addMonths, format, formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CalendarClock, Download, Gauge, Wrench } from 'lucide-react';
import type { AssetType } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { AssetHealthTicker, healthBar, healthTone } from '@/components/anomaly/asset-ticker';
import { ASSET_TYPE_LABELS, DETECTION_CLASSES } from '@/lib/anomaly/taxonomy';
import { downloadCsv, stamp } from '@/lib/anomaly/csv';
import { cn } from '@/lib/utils';

export default function AssetsPage() {
  const { assets, wear, simulateIncident } = useAnomaly();
  const [type, setType] = useState<AssetType | 'all'>('all');
  const [highlight, setHighlight] = useState<string | null>(null);

  const visible = assets.filter(a => type === 'all' || a.type === type).sort((a, b) => a.healthPct - b.healthPct);
  const avg = Math.round(assets.reduce((n, a) => n + a.healthPct, 0) / Math.max(1, assets.length));
  const atRisk = assets.filter(a => a.healthPct < 50).length;
  const dueSoon = assets.filter(a => a.remainingLifeMonths <= 12).length;
  const weekAgo = Date.now() - 7 * 86400000;
  const lostThisWeek = wear
    .filter(w => new Date(w.at).getTime() > weekAgo && w.healthDeltaPct < 0)
    .reduce((n, w) => n + Math.abs(w.healthDeltaPct), 0);
  const assetName = (id: string) => assets.find(a => a.id === id)?.name ?? id;
  const log = wear.filter(w => !highlight || w.assetId === highlight);

  const exportWear = () =>
    downloadCsv(
      `anomalyguard-wear-log-${stamp()}.csv`,
      wear.map(w => ({
        timestamp: w.at,
        asset_id: w.assetId,
        asset: assetName(w.assetId),
        cause: w.cause,
        health_delta_pct: w.healthDeltaPct,
        life_delta_months: w.lifeDeltaMonths,
        alert_id: w.alertId,
        note: w.note,
      }))
    );

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Asset Health</h1>
          <p className="text-muted-foreground">
            Predictive maintenance: every leak or lamp outage the cameras flag is converted into measurable lifespan impact.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => simulateIncident('pipe_leak')}>
            Simulate leak
          </Button>
          <Button variant="outline" size="sm" onClick={() => simulateIncident('lamp_off')}>
            Simulate lamp outage
          </Button>
          <Button size="sm" onClick={exportWear}>
            <Download className="h-4 w-4 mr-1.5" />
            Wear log CSV
          </Button>
        </div>
      </div>

      <AssetHealthTicker />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Gauge} label="Average asset health" value={`${avg}%`} tone={healthTone(avg)} />
        <Kpi icon={AlertTriangle} label="Assets below 50%" value={atRisk} />
        <Kpi icon={CalendarClock} label="Replacement due ≤ 12 mo" value={dueSoon} />
        <Kpi icon={Wrench} label="Health lost (7 days)" value={`${lostThisWeek} pts`} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Asset register</CardTitle>
            <CardDescription>Sorted by health, worst first. Select a row to filter the wear log.</CardDescription>
          </div>
          <Select value={type} onValueChange={v => setType(v as AssetType | 'all')}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All asset types</SelectItem>
              {(Object.keys(ASSET_TYPE_LABELS) as AssetType[])
                .filter(t => assets.some(a => a.type === t))
                .map(t => (
                  <SelectItem key={t} value={t}>
                    {ASSET_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Asset</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium w-[220px]">Health</th>
                <th className="p-3 font-medium">Remaining life</th>
                <th className="p-3 font-medium">Projected replacement</th>
                <th className="p-3 font-medium">Last event</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(a => {
                const last = wear.find(w => w.assetId === a.id);
                return (
                  <tr
                    key={a.id}
                    onClick={() => setHighlight(highlight === a.id ? null : a.id)}
                    className={cn('border-b last:border-0 cursor-pointer hover:bg-muted/40', highlight === a.id && 'bg-muted')}
                  >
                    <td className="p-3">
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.location} · {a.cameraId ?? '-'}
                      </p>
                    </td>
                    <td className="p-3 text-xs">{ASSET_TYPE_LABELS[a.type]}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                          <div className={cn('h-full rounded-full', healthBar(a.healthPct))} style={{ width: `${a.healthPct}%` }} />
                        </div>
                        <span className={cn('w-10 text-right text-xs font-semibold tabular-nums', healthTone(a.healthPct))}>
                          {a.healthPct}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-xs tabular-nums">{a.remainingLifeMonths} months</td>
                    <td className="p-3 text-xs">
                      {format(addMonths(new Date(), a.remainingLifeMonths), 'MMM yyyy')}
                      {a.remainingLifeMonths <= 12 && (
                        <Badge variant="outline" className="ml-2 text-[10px] border-amber-300 text-amber-700 dark:text-amber-300">
                          Budget now
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {last ? formatDistanceToNow(new Date(last.at), { addSuffix: true }) : 'No events'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wear log</CardTitle>
          <CardDescription>
            {highlight ? `Events for ${assetName(highlight)}` : 'Every lifespan impact and repair across the township'}
            {highlight && (
              <Button variant="link" size="sm" className="h-auto p-0 ml-2" onClick={() => setHighlight(null)}>
                Show all
              </Button>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-y bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">When</th>
                <th className="p-3 font-medium">Asset</th>
                <th className="p-3 font-medium">Cause</th>
                <th className="p-3 font-medium text-right">Health</th>
                <th className="p-3 font-medium text-right">Lifespan</th>
                <th className="p-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {log.slice(0, 80).map(w => (
                <tr key={w.id} className="border-b last:border-0">
                  <td className="p-3 text-xs whitespace-nowrap">{new Date(w.at).toLocaleString('en-MY', { hour12: false })}</td>
                  <td className="p-3 text-xs">{assetName(w.assetId)}</td>
                  <td className="p-3 text-xs">
                    {w.cause === 'repair' ? (
                      <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 dark:text-emerald-300">
                        Repair
                      </Badge>
                    ) : (
                      DETECTION_CLASSES[w.cause].label
                    )}
                  </td>
                  <td className={cn('p-3 text-xs text-right tabular-nums font-medium', w.healthDeltaPct < 0 ? 'text-red-600' : 'text-emerald-600')}>
                    {w.healthDeltaPct > 0 ? '+' : ''}
                    {w.healthDeltaPct}%
                  </td>
                  <td className="p-3 text-xs text-right tabular-nums">
                    {w.lifeDeltaMonths > 0 ? '+' : ''}
                    {w.lifeDeltaMonths} mo
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {w.note}
                    {w.alertId && (
                      <Link href={`/dashboard/alerts?focus=${w.alertId}`} className="ml-1 underline font-mono">
                        {w.alertId}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {log.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">
                    No wear events recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </p>
        <p className={cn('mt-1 text-2xl font-bold tabular-nums', tone)}>{value}</p>
      </CardContent>
    </Card>
  );
}
