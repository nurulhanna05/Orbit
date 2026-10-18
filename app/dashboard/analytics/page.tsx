"use client"

import { useMemo, useState } from 'react';
import { format, startOfDay, subDays } from 'date-fns';
import { Download, FileSpreadsheet } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Alert, Severity } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { DETECTION_CLASS_LIST, SEVERITY_META } from '@/lib/anomaly/taxonomy';
import { nameOf } from '@/lib/anomaly/seed';
import { downloadCsv, stamp } from '@/lib/anomaly/csv';

// Status steps from the validated reference palette; always paired with a text label.
const SEVERITY_FILL: Record<Severity, string> = { critical: '#d03b3b', warning: '#fab219', info: '#8a8a85' };
const SEVERITIES: Severity[] = ['critical', 'warning', 'info'];

type Range = '24h' | '7d' | 'all';
const RANGE_MS: Record<Range, number> = { '24h': 86400000, '7d': 7 * 86400000, all: Infinity };

const axisProps = { stroke: 'hsl(var(--muted-foreground))', fontSize: 11, tickLine: false, axisLine: false };
const tooltipStyle = {
  contentStyle: {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 6,
    fontSize: 12,
    color: 'hsl(var(--popover-foreground))',
  },
  cursor: { fill: 'hsl(var(--muted))', opacity: 0.5 },
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export default function AnalyticsPage() {
  const { alerts, tickets, cameras, settings } = useAnomaly();
  const [range, setRange] = useState<Range>('7d');

  const inRange = useMemo(() => {
    const cutoff = Date.now() - RANGE_MS[range];
    return alerts.filter(a => new Date(a.createdAt).getTime() >= cutoff);
  }, [alerts, range]);

  const byClass = DETECTION_CLASS_LIST.map(c => {
    const rows = inRange.filter(a => a.detectionClass === c.id);
    const resolvedMins = rows
      .filter(a => a.resolvedAt)
      .map(a => (new Date(a.resolvedAt!).getTime() - new Date(a.createdAt).getTime()) / 60000);
    return {
      id: c.id,
      name: c.label,
      color: c.color,
      count: rows.length,
      avgConfidence: Number(mean(rows.map(a => a.confidence)).toFixed(3)),
      mttrMins: Math.round(mean(resolvedMins)),
      ticketed: rows.filter(a => a.ticketId).length,
    };
  });

  const byCamera = cameras
    .map(cam => {
      const rows = inRange.filter(a => a.cameraId === cam.id);
      return {
        name: cam.id,
        full: cam.name,
        ...Object.fromEntries(SEVERITIES.map(s => [s, rows.filter(a => a.severity === s).length])),
        total: rows.length,
      } as { name: string; full: string; total: number } & Record<Severity, number>;
    })
    .sort((a, b) => b.total - a.total);

  const days = range === '24h' ? 1 : 7;
  const trend = Array.from({ length: days }, (_, i) => {
    const day = startOfDay(subDays(new Date(), days - 1 - i));
    const next = day.getTime() + 86400000;
    const rows = alerts.filter(a => {
      const t = new Date(a.createdAt).getTime();
      return t >= day.getTime() && t < next;
    });
    return {
      name: format(day, 'EEE d'),
      ...Object.fromEntries(SEVERITIES.map(s => [s, rows.filter(a => a.severity === s).length])),
    } as { name: string } & Record<Severity, number>;
  });

  const avgConfidence = mean(inRange.map(a => a.confidence));
  const resolvedRows = inRange.filter(a => a.resolvedAt);
  const mttr = mean(resolvedRows.map(a => (new Date(a.resolvedAt!).getTime() - new Date(a.createdAt).getTime()) / 60000));

  const exportAlerts = () =>
    downloadCsv(
      `anomalyguard-alerts-${range}-${stamp()}.csv`,
      inRange.map((a: Alert) => ({
        alert_id: a.id,
        detected_at: a.createdAt,
        class: a.detectionClass,
        severity: a.severity,
        confidence: a.confidence,
        camera_id: a.cameraId,
        camera: a.cameraName,
        zone: a.zone,
        status: a.status,
        dispatched_to: a.dispatchedTo ? nameOf(a.dispatchedTo) : '',
        ticket_id: a.ticketId,
        resolved_at: a.resolvedAt,
        source: a.source,
        privacy: 'faces anonymised at edge; no identity data',
      }))
    );
  const exportTickets = () =>
    downloadCsv(
      `anomalyguard-tickets-${stamp()}.csv`,
      tickets.map(t => ({
        ticket_id: t.id,
        title: t.title,
        class: t.detectionClass,
        priority: t.priority,
        status: t.status,
        contractor: nameOf(t.contractorId),
        location: t.location,
        alert_id: t.alertId,
        created_at: t.createdAt,
        started_at: t.startedAt,
        resolved_at: t.resolvedAt,
      }))
    );
  const exportSummary = () =>
    downloadCsv(
      `anomalyguard-summary-${range}-${stamp()}.csv`,
      byClass.map(c => ({
        township: settings.township,
        period: range,
        class: c.id,
        detections: c.count,
        avg_confidence: c.avgConfidence,
        mean_time_to_resolve_mins: c.mttrMins,
        tickets_raised: c.ticketed,
      }))
    );

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics &amp; Reports</h1>
          <p className="text-muted-foreground">
            Anomaly distribution and response performance for {settings.township}. Exports carry no personal data.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" value={range} onValueChange={v => v && setRange(v as Range)}>
            <ToggleGroupItem value="24h" size="sm">24h</ToggleGroupItem>
            <ToggleGroupItem value="7d" size="sm">7 days</ToggleGroupItem>
            <ToggleGroupItem value="all" size="sm">All</ToggleGroupItem>
          </ToggleGroup>
          <Button size="sm" variant="outline" onClick={exportAlerts}>
            <Download className="h-4 w-4 mr-1.5" />
            Alerts CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportTickets}>
            <Download className="h-4 w-4 mr-1.5" />
            Tickets CSV
          </Button>
          <Button size="sm" onClick={exportSummary}>
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            Audit summary
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Tile label="Detections" value={inRange.length} />
        <Tile label="Average confidence" value={avgConfidence ? avgConfidence.toFixed(2) : '-'} />
        <Tile label="Mean time to resolve" value={mttr ? `${Math.round(mttr)} min` : '-'} />
        <Tile label="Resolved" value={`${inRange.length ? Math.round((resolvedRows.length / inRange.length) * 100) : 0}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Anomalies by class" description="Count of detections per class in the selected period">
          <BarChart data={byClass} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="name" {...axisProps} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="count" name="Detections" radius={[4, 4, 0, 0]} maxBarSize={36}>
              {byClass.map(c => (
                <Cell key={c.id} fill={c.color} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Anomalies by camera" description="Stacked by severity">
          <BarChart data={byCamera} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip {...tooltipStyle} labelFormatter={(id: string) => byCamera.find(c => c.name === id)?.full ?? id} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {SEVERITIES.map((s, i) => (
              <Bar
                key={s}
                dataKey={s}
                name={SEVERITY_META[s].label}
                stackId="sev"
                fill={SEVERITY_FILL[s]}
                stroke="hsl(var(--card))"
                strokeWidth={2}
                maxBarSize={36}
                radius={i === SEVERITIES.length - 1 ? [4, 4, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ChartCard>

        <ChartCard title="Average confidence by class" description="Mean model confidence of retained detections (0 to 1)">
          <BarChart data={byClass} layout="vertical" margin={{ top: 8, right: 24, left: 24, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" domain={[0, 1]} {...axisProps} />
            <YAxis type="category" dataKey="name" width={110} {...axisProps} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => v.toFixed(2)} />
            <Bar dataKey="avgConfidence" name="Avg confidence" radius={[0, 4, 4, 0]} maxBarSize={18}>
              {byClass.map(c => (
                <Cell key={c.id} fill={c.color} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Daily trend" description={range === '24h' ? 'Today, by severity' : 'Last 7 days, by severity'}>
          <BarChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {SEVERITIES.map((s, i) => (
              <Bar
                key={s}
                dataKey={s}
                name={SEVERITY_META[s].label}
                stackId="sev"
                fill={SEVERITY_FILL[s]}
                stroke="hsl(var(--card))"
                strokeWidth={2}
                maxBarSize={40}
                radius={i === SEVERITIES.length - 1 ? [4, 4, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Class summary</CardTitle>
          <CardDescription>Table view of the charts above; matches the audit summary export.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Class</th>
                <th className="p-3 font-medium text-right">Detections</th>
                <th className="p-3 font-medium text-right">Avg confidence</th>
                <th className="p-3 font-medium text-right">Mean time to resolve</th>
                <th className="p-3 font-medium text-right">Tickets raised</th>
              </tr>
            </thead>
            <tbody>
              {byClass.map(c => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
                      {c.name}
                      <code className="text-[10px] text-muted-foreground">{c.id}</code>
                    </span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{c.count}</td>
                  <td className="p-3 text-right tabular-nums">{c.count ? c.avgConfidence.toFixed(2) : '-'}</td>
                  <td className="p-3 text-right tabular-nums">{c.mttrMins ? `${c.mttrMins} min` : '-'}</td>
                  <td className="p-3 text-right tabular-nums">{c.ticketed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactElement }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
