"use client"

import { useMemo, useState } from 'react';
import { format, startOfDay, subDays } from 'date-fns';
import { Download, FileSpreadsheet, TrendingDown, TrendingUp } from 'lucide-react';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Alert, Severity } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { DETECTION_CLASS_LIST, SEVERITY_META } from '@/lib/anomaly/taxonomy';
import { nameOf } from '@/lib/anomaly/seed';
import { downloadCsv, stamp } from '@/lib/anomaly/csv';
import { PageHeader } from '@/components/layout/page-header';
import { TONE_CHART, TONE_ICON } from '@/components/anomaly/status';

// Two colour systems, never on the same chart:
// - comparison charts are neutral, with the one bar that matters in the strong neutral;
// - severity charts use the status palette (critical / warning / info), the same tokens as every badge.
const STRONG = 'hsl(var(--chart-strong))';
const MUTED = 'hsl(var(--chart-muted))';
const SEVERITY_FILL: Record<Severity, string> = { critical: TONE_CHART.critical, warning: TONE_CHART.warning, info: TONE_CHART.info };
const SEVERITIES: Severity[] = ['critical', 'warning', 'info'];

type Range = '24h' | '7d' | 'all';
const RANGE_MS: Record<Range, number> = { '24h': 86400000, '7d': 7 * 86400000, all: Infinity };
const RANGE_LABEL: Record<Range, string> = { '24h': 'last 24 hours', '7d': 'last 7 days', all: 'all time' };

const axisProps = { stroke: 'hsl(var(--muted-foreground))', fontSize: 12, tickLine: false, axisLine: false };
// Direct value labels on bars, so the value axis and gridlines can go.
const valueLabel = { fill: 'hsl(var(--foreground))', fontSize: 12 };
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
  // The single most frequent class is the one bar that gets the strong neutral. Bars are sorted, largest first.
  const topClassId = byClass.reduce((top, c) => (c.count > top.count ? c : top), byClass[0])?.id;
  const byCount = [...byClass].sort((a, b) => b.count - a.count);
  const byConfidence = [...byClass].filter(c => c.count).sort((a, b) => b.avgConfidence - a.avgConfidence);

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
      `orbit-alerts-${range}-${stamp()}.csv`,
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
      `orbit-tickets-${stamp()}.csv`,
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
      `orbit-summary-${range}-${stamp()}.csv`,
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
    <div className="mx-auto max-w-[1600px] space-y-6">
      {/* Toolbar: the range filter comes first because it changes everything below; the audit summary is the
          one primary export, the raw CSVs are quieter ghost buttons. */}
      <PageHeader
        title="Analytics & Reports"
        description={<>How fast is the township responding? {settings.township}, {RANGE_LABEL[range]}. Exports carry no personal data.</>}
        actions={
          <>
            <ToggleGroup type="single" value={range} onValueChange={v => v && setRange(v as Range)} aria-label="Time range">
              <ToggleGroupItem value="24h" size="sm">24 hours</ToggleGroupItem>
              <ToggleGroupItem value="7d" size="sm">7 days</ToggleGroupItem>
              <ToggleGroupItem value="all" size="sm">All</ToggleGroupItem>
            </ToggleGroup>
            <Button size="sm" variant="ghost" onClick={exportAlerts}>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Alerts CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={exportTickets}>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Tickets CSV
            </Button>
            <Button size="sm" onClick={exportSummary}>
              <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden />
              Audit summary
            </Button>
          </>
        }
      />

      {/* KPIs: one hero metric wins the eye; the other three are supporting context in a single quiet card. */}
      <section aria-label="Key metrics" className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <HeroKpi mttr={mttr} previousMttr={previousMttr} resolvedCount={resolvedCount} />

        <Card>
          <CardContent className="h-full p-6">
            <dl className="grid h-full grid-cols-3 content-center gap-4 lg:grid-cols-1">
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
              description="Detections per class, most frequent first. The highlighted bar is the most frequent."
              height="h-[340px]"
            >
              <BarChart data={byCount} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} {...axisProps} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" name="Detections" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {/* Strong neutral on the top class only; the rest stay muted so the comparison reads instantly. */}
                  {byCount.map(c => (
                    <Cell key={c.id} fill={c.id === topClassId && c.count > 0 ? STRONG : MUTED} />
                  ))}
                  <LabelList dataKey="count" position="right" {...valueLabel} />
                </Bar>
              </BarChart>
            </ChartCard>

            <ChartCard
              title="Anomalies by camera"
              description={
                criticalOpen
                  ? `Busiest first, split by severity. ${criticalOpen} critical ${criticalOpen === 1 ? 'alert is' : 'alerts are'} still open.`
                  : 'Busiest first, split by severity.'
              }
              height="h-[340px]"
              legend
            >
              <BarChart data={byCamera} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="full" width={150} {...axisProps} />
                <Tooltip {...tooltipStyle} />
                {severityBars(28, 'horizontal')}
              </BarChart>
            </ChartCard>
          </div>
        </TabsContent>

        {/* Details: the secondary charts and the table, for when someone wants to dig in. */}
        <TabsContent value="details" className="mt-0 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Daily trend"
              description={range === '24h' ? 'Today, split by severity' : 'Last 7 days in date order, split by severity'}
              legend
            >
              <BarChart data={trend} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="name" {...axisProps} />
                <YAxis hide allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                {severityBars(40, 'vertical')}
              </BarChart>
            </ChartCard>

            <ChartCard title="Average confidence by class" description="Mean model confidence of retained detections, highest first">
              <BarChart data={byConfidence} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
                <XAxis type="number" hide domain={[0, 1]} />
                <YAxis type="category" dataKey="name" width={120} {...axisProps} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => `${Math.round(v * 100)}%`} />
                {/* All neutral: this chart is for reference, not for drawing attention. */}
                <Bar dataKey="avgConfidence" name="Average confidence" fill={MUTED} radius={[0, 4, 4, 0]} maxBarSize={20}>
                  <LabelList dataKey="avgConfidence" position="right" formatter={(v: number) => `${Math.round(v * 100)}%`} {...valueLabel} />
                </Bar>
              </BarChart>
            </ChartCard>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Class summary</CardTitle>
              <CardDescription>The same figures as the audit summary export.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-3 font-medium">Class</th>
                    <th scope="col" className="p-3 text-right font-medium">Detections</th>
                    <th scope="col" className="p-3 text-right font-medium">Average confidence</th>
                    <th scope="col" className="p-3 text-right font-medium">Mean time to resolve</th>
                    <th scope="col" className="p-3 text-right font-medium">Tickets raised</th>
                  </tr>
                </thead>
                <tbody>
                  {byClass.map(c => (
                    <tr key={c.id} className="border-b last:border-0">
                      <th scope="row" className="p-3 text-left font-normal">
                        {c.name}
                      </th>
                      <td className="p-3 text-right tabular">{c.count}</td>
                      <td className="p-3 text-right tabular">{c.count ? `${Math.round(c.avgConfidence * 100)}%` : '—'}</td>
                      <td className="p-3 text-right tabular">{formatMins(c.mttrMins)}</td>
                      <td className="p-3 text-right tabular">{c.ticketed}</td>
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

// Hero KPI: visually dominant through size alone: the largest type on the page and the only KPI with a trend.
// Mean time to resolve is the hero because it is the outcome the township team is judged on.
function HeroKpi({ mttr, previousMttr, resolvedCount }: { mttr: number | null; previousMttr: number | null; resolvedCount: number }) {
  const delta = mttr !== null && previousMttr !== null ? mttr - previousMttr : null;
  const Trend = delta !== null && delta > 0 ? TrendingUp : TrendingDown;
  return (
    <Card>
      <CardContent className="p-6 sm:p-8">
        <h2 className="text-sm font-medium text-muted-foreground">Mean time to resolve</h2>
        <p className="mt-2 text-5xl font-semibold tracking-tight tabular sm:text-6xl">
          {mttr === null ? '—' : mttr}
          {mttr !== null && <span className="ml-2 text-2xl font-semibold text-muted-foreground">min</span>}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          {mttr === null ? 'No valid resolution times in this period.' : `From detection to resolution, across ${resolvedCount} resolved alerts.`}
          {/* Trend in words with an arrow; a slower response is a warning, so it takes the warning tone and icon. */}
          {delta !== null && delta !== 0 && (
            <span className={delta > 0 ? 'ml-1 inline-flex items-center gap-1 font-medium text-warning-fg' : 'ml-1 inline-flex items-center gap-1 font-medium text-foreground'}>
              <Trend className="h-4 w-4" aria-hidden />
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
      <dd className="mt-1 text-xl font-semibold tabular">{value}</dd>
    </div>
  );
}

// Severity stack shared by the camera and trend charts, so each status colour always means the same thing.
// The last segment carries the stack total as a direct label.
// A plain function, not a component: Recharts only renders <Bar> elements that are direct chart children.
function severityBars(maxBarSize: number, orientation: 'horizontal' | 'vertical') {
  const last = SEVERITIES.length - 1;
  return SEVERITIES.map((s, i) => (
    <Bar
      key={s}
      dataKey={s}
      name={SEVERITY_META[s].label}
      stackId="sev"
      fill={SEVERITY_FILL[s]}
      stroke="hsl(var(--card))"
      strokeWidth={1}
      maxBarSize={maxBarSize}
      radius={i === last ? (orientation === 'horizontal' ? [0, 4, 4, 0] : [4, 4, 0, 0]) : undefined}
    >
      {i === last && (
        <LabelList
          position={orientation === 'horizontal' ? 'right' : 'top'}
          valueAccessor={(entry: { payload: Record<Severity, number> }) =>
            SEVERITIES.reduce((n, k) => n + (entry.payload[k] ?? 0), 0) || ''
          }
          {...valueLabel}
        />
      )}
    </Bar>
  ));
}

// Severity key for stacked charts: icon, swatch and label, so no series is identified by colour alone.
function SeverityLegend() {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-label="Severity key">
      {SEVERITIES.map(s => {
        const Icon = TONE_ICON[s];
        return (
          <li key={s} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: SEVERITY_FILL[s] }} aria-hidden />
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {SEVERITY_META[s].label}
          </li>
        );
      })}
    </ul>
  );
}

function ChartCard({
  title,
  description,
  height = 'h-[280px]',
  legend = false,
  children,
}: {
  title: string;
  description: string;
  height?: string;
  legend?: boolean;
  children: React.ReactElement;
}) {
  return (
    <Card>
      <CardHeader className="space-y-1 pb-2">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {legend && <SeverityLegend />}
      </CardHeader>
      <CardContent className={height}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
