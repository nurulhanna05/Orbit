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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { DETECTION_CLASS_LIST, SEVERITY_META } from '@/lib/anomaly/taxonomy';
import { nameOf } from '@/lib/anomaly/seed';
import { downloadCsv, stamp } from '@/lib/anomaly/csv';

// Palette: neutral greys carry most of the data, one accent (the brand emerald) marks what matters most,
// and red is reserved for critical severity and for a worsening trend. Nothing else gets a colour.
const ACCENT = '#059669';
const NEUTRAL = '#a3a3a3';
const CRITICAL = '#d03b3b';
// Severity is still distinguishable without colour: critical is red, warning a darker grey than info,
// and every series carries a text label in the legend and tooltip.
const SEVERITY_FILL: Record<Severity, string> = { critical: CRITICAL, warning: '#737373', info: '#d4d4d4' };
const SEVERITIES: Severity[] = ['critical', 'warning', 'info'];

type Range = '24h' | '7d' | 'all';
const RANGE_MS: Record<Range, number> = { '24h': 86400000, '7d': 7 * 86400000, all: Infinity };
const RANGE_LABEL: Record<Range, string> = { '24h': 'last 24 hours', '7d': 'last 7 days', all: 'all time' };

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

// Legend text in the normal text colour: the pale "Info" swatch would otherwise make its own label unreadable.
const legendProps = {
  wrapperStyle: { fontSize: 12 },
  formatter: (value: string) => <span className="text-muted-foreground">{value}</span>,
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// Minutes from detection to resolution, for resolved alerts only.
// Data integrity: an alert whose resolvedAt is earlier than its createdAt once pushed the mean negative
// (-154 min). The app itself always resolves at now(); that record was hand-edited test data in browser storage.
// TODO: if real edge data ever arrives with skewed clocks, validate timestamps where alerts are ingested.
// Until then, impossible (negative) durations are left out here, and the KPI shows "—" when none are valid.
const resolveMinutes = (rows: Alert[]) =>
  rows
    .filter(a => a.resolvedAt)
    .map(a => (new Date(a.resolvedAt!).getTime() - new Date(a.createdAt).getTime()) / 60000)
    .filter(mins => Number.isFinite(mins) && mins >= 0);

// Mean time to resolve in whole minutes, or null when there is nothing valid to average.
const mttrOf = (rows: Alert[]) => {
  const mins = resolveMinutes(rows);
  return mins.length ? Math.round(mean(mins)) : null;
};

const formatMins = (mins: number | null) => (mins === null ? '—' : `${mins} min`);

export default function AnalyticsPage() {
  const { alerts, tickets, cameras, settings } = useAnomaly();
  const [range, setRange] = useState<Range>('7d');

  const inRange = useMemo(() => {
    const cutoff = Date.now() - RANGE_MS[range];
    return alerts.filter(a => new Date(a.createdAt).getTime() >= cutoff);
  }, [alerts, range]);

  // The period just before the selected one, so the hero KPI can show a trend. Not defined for "All".
  const previous = useMemo(() => {
    if (range === 'all') return null;
    const end = Date.now() - RANGE_MS[range];
    const start = end - RANGE_MS[range];
    return alerts.filter(a => {
      const t = new Date(a.createdAt).getTime();
      return t >= start && t < end;
    });
  }, [alerts, range]);

  const byClass = DETECTION_CLASS_LIST.map(c => {
    const rows = inRange.filter(a => a.detectionClass === c.id);
    return {
      id: c.id,
      name: c.label,
      count: rows.length,
      avgConfidence: Number(mean(rows.map(a => a.confidence)).toFixed(3)),
      mttrMins: mttrOf(rows),
      ticketed: rows.filter(a => a.ticketId).length,
    };
  });
  // The single most frequent class is the one bar that gets the accent colour.
  const topClassId = byClass.reduce((top, c) => (c.count > top.count ? c : top), byClass[0])?.id;

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
  const resolvedCount = inRange.filter(a => a.resolvedAt).length;
  const mttr = mttrOf(inRange);
  const previousMttr = previous ? mttrOf(previous) : null;
  const criticalOpen = inRange.filter(a => a.severity === 'critical' && a.status !== 'resolved').length;

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
        mean_time_to_resolve_mins: c.mttrMins ?? '',
        tickets_raised: c.ticketed,
      }))
    );

  return (
    <div className="container mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics &amp; Reports</h1>
          <p className="text-muted-foreground">
            Response performance for {settings.township}, {RANGE_LABEL[range]}. Exports carry no personal data.
          </p>
        </div>
        {/* Toolbar: the range filter comes first because it changes everything below; the audit summary is the
            one primary export, the raw CSVs are quieter ghost buttons. */}
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" value={range} onValueChange={v => v && setRange(v as Range)} aria-label="Time range">
            <ToggleGroupItem value="24h" size="sm">24h</ToggleGroupItem>
            <ToggleGroupItem value="7d" size="sm">7 days</ToggleGroupItem>
            <ToggleGroupItem value="all" size="sm">All</ToggleGroupItem>
          </ToggleGroup>
          <Button size="sm" variant="ghost" onClick={exportAlerts}>
            <Download className="h-4 w-4 mr-1.5" />
            Alerts CSV
          </Button>
          <Button size="sm" variant="ghost" onClick={exportTickets}>
            <Download className="h-4 w-4 mr-1.5" />
            Tickets CSV
          </Button>
          <Button size="sm" onClick={exportSummary}>
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            Audit summary
          </Button>
        </div>
      </header>

      {/* KPIs: one hero metric wins the eye; the other three are supporting context in a single quiet card. */}
      <section aria-label="Key metrics" className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <HeroKpi mttr={mttr} previousMttr={previousMttr} resolvedCount={resolvedCount} />

        <Card>
          <CardContent className="p-6 h-full">
            <dl className="grid h-full grid-cols-3 lg:grid-cols-1 gap-4 content-center">
              <SecondaryKpi label="Detections" value={inRange.length} />
              <SecondaryKpi
                label="Resolved"
                value={`${inRange.length ? Math.round((resolvedCount / inRange.length) * 100) : 0}%`}
              />
              <SecondaryKpi label="Average confidence" value={avgConfidence ? avgConfidence.toFixed(2) : '—'} />
            </dl>
          </CardContent>
        </Card>
      </section>

      {/* Two tabs: the overview answers "where and what" at a glance; everything else lives in Details. */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Overview: two large charts side by side, nothing else competing with them. */}
        <TabsContent value="overview" className="mt-0">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Anomalies by class"
              description="Detections per class. The most frequent class is highlighted."
              height="h-[340px]"
            >
              <BarChart data={byClass} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" {...axisProps} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" name="Detections" radius={[4, 4, 0, 0]} maxBarSize={44}>
                  {/* Accent on the top class only; the rest stay neutral so the comparison reads instantly. */}
                  {byClass.map(c => (
                    <Cell key={c.id} fill={c.id === topClassId && c.count > 0 ? ACCENT : NEUTRAL} />
                  ))}
                </Bar>
              </BarChart>
            </ChartCard>

            <ChartCard
              title="Anomalies by camera"
              description={
                criticalOpen
                  ? `Stacked by severity. ${criticalOpen} critical ${criticalOpen === 1 ? 'alert is' : 'alerts are'} still open.`
                  : 'Stacked by severity. Red marks critical alerts.'
              }
              height="h-[340px]"
            >
              <BarChart data={byCamera} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip {...tooltipStyle} labelFormatter={(id: string) => byCamera.find(c => c.name === id)?.full ?? id} />
                <Legend {...legendProps} />
                {severityBars(44)}
              </BarChart>
            </ChartCard>
          </div>
        </TabsContent>

        {/* Details: the secondary charts and the table, for when someone wants to dig in. */}
        <TabsContent value="details" className="mt-0 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Daily trend" description={range === '24h' ? 'Today, by severity' : 'Last 7 days, by severity'}>
              <BarChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip {...tooltipStyle} />
                <Legend {...legendProps} />
                {severityBars(40)}
              </BarChart>
            </ChartCard>

            <ChartCard title="Average confidence by class" description="Mean model confidence of retained detections (0 to 1)">
              <BarChart data={byClass} layout="vertical" margin={{ top: 8, right: 24, left: 24, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 1]} {...axisProps} />
                <YAxis type="category" dataKey="name" width={110} {...axisProps} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => v.toFixed(2)} />
                {/* All neutral: this chart is for reference, not for drawing attention. */}
                <Bar dataKey="avgConfidence" name="Avg confidence" fill={NEUTRAL} radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ChartCard>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Class summary</CardTitle>
              <CardDescription>The same figures as the audit summary export.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-3 font-medium">Class</th>
                    <th scope="col" className="p-3 font-medium text-right">Detections</th>
                    <th scope="col" className="p-3 font-medium text-right">Avg confidence</th>
                    <th scope="col" className="p-3 font-medium text-right">Mean time to resolve</th>
                    <th scope="col" className="p-3 font-medium text-right">Tickets raised</th>
                  </tr>
                </thead>
                <tbody>
                  {byClass.map(c => (
                    <tr key={c.id} className="border-b last:border-0">
                      <th scope="row" className="p-3 text-left font-normal">
                        {c.name} <code className="ml-1 text-[10px] text-muted-foreground">{c.id}</code>
                      </th>
                      <td className="p-3 text-right tabular-nums">{c.count}</td>
                      <td className="p-3 text-right tabular-nums">{c.count ? c.avgConfidence.toFixed(2) : '—'}</td>
                      <td className="p-3 text-right tabular-nums">{formatMins(c.mttrMins)}</td>
                      <td className="p-3 text-right tabular-nums">{c.ticketed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Hero KPI: visually dominant. Largest type on the page, the accent colour, and the only KPI with a trend.
// Mean time to resolve is the hero because it is the outcome the township team is judged on.
function HeroKpi({ mttr, previousMttr, resolvedCount }: { mttr: number | null; previousMttr: number | null; resolvedCount: number }) {
  const delta = mttr !== null && previousMttr !== null ? mttr - previousMttr : null;
  return (
    <Card className="border-l-4" style={{ borderLeftColor: ACCENT }}>
      <CardContent className="p-6 sm:p-8">
        <h2 className="text-sm font-medium text-muted-foreground">Mean time to resolve</h2>
        <p className="mt-2 text-5xl sm:text-6xl font-bold tracking-tight tabular-nums" style={{ color: mttr === null ? undefined : ACCENT }}>
          {mttr === null ? '—' : mttr}
          {mttr !== null && <span className="ml-2 text-2xl font-semibold text-muted-foreground">min</span>}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          {mttr === null ? 'No valid resolution times in this period.' : `From detection to resolution, across ${resolvedCount} resolved alerts.`}
          {/* Trend: red only when response got slower; an improvement stays neutral rather than adding a colour. */}
          {delta !== null && delta !== 0 && (
            <span className={delta > 0 ? 'ml-1 font-medium text-[#d03b3b]' : 'ml-1 font-medium text-foreground'}>
              {delta > 0 ? `${delta} min slower` : `${-delta} min faster`} than the previous period.
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

// Secondary KPIs: small, neutral, no colour. Context for the hero, not competition for it.
function SecondaryKpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

// Severity stack shared by the camera and trend charts, so red always means the same thing.
// A plain function, not a component: Recharts only renders <Bar> elements that are direct chart children.
function severityBars(maxBarSize: number) {
  return SEVERITIES.map((s, i) => (
        <Bar
          key={s}
          dataKey={s}
          name={SEVERITY_META[s].label}
          stackId="sev"
          fill={SEVERITY_FILL[s]}
          stroke="hsl(var(--card))"
          strokeWidth={2}
          maxBarSize={maxBarSize}
          radius={i === SEVERITIES.length - 1 ? [4, 4, 0, 0] : undefined}
        />
      ));
}

function ChartCard({
  title,
  description,
  height = 'h-[280px]',
  children,
}: {
  title: string;
  description: string;
  height?: string;
  children: React.ReactElement;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={height}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
