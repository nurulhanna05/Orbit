"use client"

import { useState } from 'react';
import Link from 'next/link';
import { addMonths, format, formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CalendarClock, Download, Gauge, Wrench } from 'lucide-react';
import type { AssetType } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { healthBar, healthTone } from '@/components/anomaly/asset-ticker';
import { PageHeader } from '@/components/layout/page-header';
import { StatTile } from '@/components/anomaly/stat-tile';
import { StatusBadge } from '@/components/anomaly/status';
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
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageHeader
        title="Asset Health"
        description="Which assets are wearing out, and when will they need replacing? Every leak or lamp outage the cameras flag counts against an asset's lifespan."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => simulateIncident('pipe_leak')}>
              Simulate leak
            </Button>
            <Button variant="outline" size="sm" onClick={() => simulateIncident('lamp_off')}>
              Simulate lamp outage
            </Button>
            <Button size="sm" onClick={exportWear}>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Wear log CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Gauge} label="Average asset health" value={`${avg}%`} tone={healthTone(avg)} />
        <StatTile icon={AlertTriangle} label="Assets below 50%" value={atRisk} />
        <StatTile icon={CalendarClock} label="Replacement due within 12 months" value={dueSoon} />
        <StatTile icon={Wrench} label="Health lost in the last 7 days" value={`${lostThisWeek} points`} />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Asset register</CardTitle>
            <CardDescription>Sorted by health, worst first. Select a row to filter the wear log.</CardDescription>
          </div>
          <Select value={type} onValueChange={v => setType(v as AssetType | 'all')}>
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by asset type">
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
            <thead className="border-y bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Asset</th>
                <th className="p-3 font-medium">Type</th>
                <th className="w-[220px] p-3 font-medium">Health</th>
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
                    className={cn('cursor-pointer border-b last:border-0 hover:bg-accent', highlight === a.id && 'bg-accent')}
                  >
                    <td className="p-3">
                      {/* The row is clickable with a mouse; this button makes the same action reachable by keyboard. */}
                      <button
                        type="button"
                        className="rounded-sm text-left font-medium max-md:min-h-11"
                        aria-pressed={highlight === a.id}
                        onClick={e => {
                          e.stopPropagation();
                          setHighlight(highlight === a.id ? null : a.id);
                        }}
                      >
                        {a.name}
                        <span className="sr-only"> (show its wear log)</span>
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {a.location} · {a.cameraId ?? '-'}
                      </p>
                    </td>
                    <td className="p-3 text-xs">{ASSET_TYPE_LABELS[a.type]}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <div className={cn('h-full rounded-full', healthBar(a.healthPct))} style={{ width: `${a.healthPct}%` }} />
                        </div>
                        <span className={cn('w-10 text-right text-xs font-semibold tabular', healthTone(a.healthPct))}>
                          {a.healthPct}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-xs tabular">{a.remainingLifeMonths} months</td>
                    <td className="whitespace-nowrap p-3 text-xs tabular">
                      {format(addMonths(new Date(), a.remainingLifeMonths), 'MMM yyyy')}
                      {a.remainingLifeMonths <= 12 && (
                        <StatusBadge tone="warning" className="ml-2">
                          Budget now
                        </StatusBadge>
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
              <Button variant="link" size="sm" className="ml-2 h-auto p-0" onClick={() => setHighlight(null)}>
                Show all
              </Button>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-[480px] overflow-auto p-0">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-y bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">When</th>
                <th className="p-3 font-medium">Asset</th>
                <th className="p-3 font-medium">Cause</th>
                <th className="p-3 text-right font-medium">Health</th>
                <th className="p-3 text-right font-medium">Lifespan</th>
                <th className="p-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {log.slice(0, 80).map(w => (
                <tr key={w.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap p-3 text-xs tabular">{new Date(w.at).toLocaleString('en-MY', { hour12: false })}</td>
                  <td className="p-3 text-xs">{assetName(w.assetId)}</td>
                  <td className="p-3 text-xs">
                    {w.cause === 'repair' ? (
                      <StatusBadge tone="success">Repair</StatusBadge>
                    ) : (
                      DETECTION_CLASSES[w.cause].label
                    )}
                  </td>
                  <td className="p-3 text-right text-xs font-medium tabular">
                    {w.healthDeltaPct > 0 ? '+' : ''}
                    {w.healthDeltaPct}%
                  </td>
                  <td className="p-3 text-right text-xs tabular">
                    {w.lifeDeltaMonths > 0 ? '+' : ''}
                    {w.lifeDeltaMonths} months
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {w.note}
                    {w.alertId && (
                      <Link href={`/dashboard/alerts?focus=${w.alertId}`} className="ml-1 font-mono text-link underline underline-offset-2">
                        {w.alertId}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {log.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
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
