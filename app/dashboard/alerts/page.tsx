"use client"

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceStrict, formatDistanceToNow } from 'date-fns';
import { CheckCircle2, ChevronDown, Image as ImageIcon, RotateCcw, Search, Send, Ticket } from 'lucide-react';
import type { Alert, DetectionClass, Severity } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { PageHeader } from '@/components/layout/page-header';
import { SeverityBadge, TONE_ICON } from '@/components/anomaly/status';
import { AlertSnapshot } from '@/components/anomaly/alert-snapshot';
import { ResolveTicketDialog } from '@/components/anomaly/resolve-ticket-dialog';
import { REPORT_RETENTION_NOTE, ReportButton } from '@/components/anomaly/report-button';
import { CONTRACTORS, nameOf } from '@/lib/anomaly/seed';
import { DETECTION_CLASSES, DETECTION_CLASS_LIST, SEVERITY_META, ZONE_LABELS } from '@/lib/anomaly/taxonomy';
import { cn } from '@/lib/utils';
import { OrbitSpinner } from '@/components/ui/orbit-spinner';

export default function AlertsPage() {
  const { alerts, markAllAlertsRead } = useAnomaly();
  const [severity, setSeverity] = useState<Severity | 'all'>('all');
  const [cls, setCls] = useState<DetectionClass | 'all'>('all');
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<string | null>(null);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);

  useEffect(() => {
    // Read ?focus= without useSearchParams so the page stays statically exportable.
    setFocus(new URLSearchParams(window.location.search).get('focus'));
  }, []);

  const matches = (a: Alert) =>
    (severity === 'all' || a.severity === severity) &&
    (cls === 'all' || a.detectionClass === cls) &&
    (!query || `${a.cameraName} ${a.message} ${a.id}`.toLowerCase().includes(query.toLowerCase()));

  const open = useMemo(
    () =>
      alerts
        .filter(a => a.status !== 'resolved' && matches(a))
        .sort((a, b) => SEVERITY_META[a.severity].rank - SEVERITY_META[b.severity].rank || b.createdAt.localeCompare(a.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alerts, severity, cls, query]
  );
  const resolved = alerts.filter(a => a.status === 'resolved' && matches(a));
  const countBy = (s: Severity) => alerts.filter(a => a.status !== 'resolved' && a.severity === s).length;
  const focused = focus ? alerts.find(a => a.id === focus) : undefined;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageHeader
        title="Alert Centre"
        description="Which anomalies need action? Dispatch a crew, raise a ticket, or resolve."
        actions={
          <Button variant="outline" size="sm" onClick={markAllAlertsRead}>
            Mark all read
          </Button>
        }
      />

      {/* One severity filter, with the open count on each option (replaces the separate count tiles). */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            aria-label="Search alerts"
            placeholder="Search camera, message or ID"
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <ToggleGroup
          type="single"
          aria-label="Filter by severity"
          value={severity}
          onValueChange={v => setSeverity((v || 'all') as Severity | 'all')}
          className="flex-wrap justify-start"
        >
          <ToggleGroupItem value="all" size="sm">All</ToggleGroupItem>
          {(['critical', 'warning', 'info'] as Severity[]).map(s => {
            const Icon = TONE_ICON[s];
            return (
              <ToggleGroupItem key={s} value={s} size="sm" className="gap-1.5">
                <Icon className="h-4 w-4" aria-hidden />
                {SEVERITY_META[s].label}
                <span className="tabular text-xs opacity-80">{countBy(s)}</span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
        <Select value={cls} onValueChange={v => setCls(v as DetectionClass | 'all')}>
          <SelectTrigger className="w-full sm:w-[200px]" aria-label="Filter by class">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {DETECTION_CLASS_LIST.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open ({open.length})</TabsTrigger>
          <TabsTrigger value="history">Resolved history ({resolved.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="mt-4 space-y-3">
          {open.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" aria-hidden />
                No open anomalies. Use Simulate incident in the top bar to run the demo flow.
              </CardContent>
            </Card>
          )}
          {open.map(a => (
            <AlertRow key={a.id} alert={a} highlighted={focused?.id === a.id} onSnapshot={() => setSnapshotId(a.id)} />
          ))}
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTable alerts={resolved} onSnapshot={a => setSnapshotId(a.id)} />
        </TabsContent>
      </Tabs>

      <SnapshotDialog alert={alerts.find(a => a.id === snapshotId) ?? null} onClose={() => setSnapshotId(null)} />
    </div>
  );
}

function AlertRow({ alert, highlighted, onSnapshot }: { alert: Alert; highlighted: boolean; onSnapshot: () => void }) {
  const { tickets, dispatchAlert, resolveAlert, createTicketFromAlert, markAlertRead } = useAnomaly();
  const [expanded, setExpanded] = useState(highlighted);
  const [resolving, setResolving] = useState(false);
  // An alert with an open ticket resolves through the ticket, so the after-fix photo and notes are captured.
  const openTicket = tickets.find(t => t.id === alert.ticketId && t.status !== 'resolved');
  const meta = DETECTION_CLASSES[alert.detectionClass];
  const recommended = CONTRACTORS.filter(c => c.handles.includes(alert.detectionClass));
  const others = CONTRACTORS.filter(c => !c.handles.includes(alert.detectionClass));

  useEffect(() => {
    if (highlighted) markAlertRead(alert.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlighted]);

  return (
    <Card className={cn(highlighted && 'ring-2 ring-ring ring-offset-2 ring-offset-background', !alert.read && 'bg-accent/50')}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={alert.severity} />
              <h2 className="text-base font-semibold">{meta.label}</h2>
              {alert.status === 'dispatched' ? (
                <Badge variant="secondary">Dispatched to {nameOf(alert.dispatchedTo)}</Badge>
              ) : (
                <Badge variant="outline">Awaiting action</Badge>
              )}
              {alert.ticketId && <Badge variant="outline">Ticket {alert.ticketId}</Badge>}
              {!alert.read && <span className="text-xs font-semibold">New</span>}
            </div>
            <p className="mt-1 text-sm">{alert.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {alert.cameraName} ({alert.cameraId}) · {ZONE_LABELS[alert.zone]} · {Math.round(alert.confidence * 100)}% confidence ·{' '}
              {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })} · ID <span className="font-mono">{alert.id}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onSnapshot}>
              {alert.snapshot?.status === 'processing' ? (
                <>
                  <OrbitSpinner className="mr-2" />
                  Snapshot…
                </>
              ) : (
                <>
                  <ImageIcon className="mr-2 h-4 w-4" aria-hidden />
                  {alert.snapshot ? 'Snapshot' : 'Frame'}
                </>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Send className="mr-2 h-4 w-4" aria-hidden />
                  Dispatch
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Recommended</DropdownMenuLabel>
                {recommended.map(c => (
                  <DropdownMenuItem key={c.id} onClick={() => dispatchAlert(alert.id, c.id)}>
                    <span className="flex-1">{c.name}</span>
                    <span className="text-xs text-muted-foreground">~{c.etaMins} min</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Other teams</DropdownMenuLabel>
                {others.map(c => (
                  <DropdownMenuItem key={c.id} onClick={() => dispatchAlert(alert.id, c.id)}>
                    <span className="flex-1">{c.name}</span>
                    <span className="text-xs text-muted-foreground">~{c.etaMins} min</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {alert.ticketId ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/dashboard/tickets?focus=${alert.ticketId}`}>
                  <Ticket className="mr-2 h-4 w-4" aria-hidden />
                  View ticket
                </Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => createTicketFromAlert(alert.id)}>
                <Ticket className="mr-2 h-4 w-4" aria-hidden />
                Raise ticket
              </Button>
            )}
            {/* Row actions are all secondary: the page has many rows, so none of them gets the primary style. */}
            <Button size="sm" variant="outline" onClick={() => (openTicket ? setResolving(true) : resolveAlert(alert.id))}>
              <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
              Resolve
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9"
              onClick={() => setExpanded(e => !e)}
              aria-expanded={expanded}
              aria-label={expanded ? 'Hide timeline' : 'Show timeline'}
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} aria-hidden />
            </Button>
          </div>
        </div>
        {expanded && (
          <ol className="mt-3 border-l pl-4 space-y-1">
            {alert.history.map((h, i) => (
              <li key={i} className="text-xs">
                <span className="text-muted-foreground">{new Date(h.at).toLocaleString('en-MY', { hour12: false })}</span> · {h.action}
              </li>
            ))}
          </ol>
        )}
        <ResolveTicketDialog ticket={resolving ? openTicket ?? null : null} onClose={() => setResolving(false)} />
      </CardContent>
    </Card>
  );
}

function HistoryTable({ alerts, onSnapshot }: { alerts: Alert[]; onSnapshot: (a: Alert) => void }) {
  const { reopenAlert, tickets } = useAnomaly();
  const [limit, setLimit] = useState(25);
  if (alerts.length === 0) return <p className="text-sm text-muted-foreground">No resolved alerts match these filters.</p>;

  return (
    <Card>
      <p className="border-b p-3 text-xs text-muted-foreground">{REPORT_RETENTION_NOTE}</p>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Detected</th>
              <th className="p-3 font-medium">Class</th>
              <th className="p-3 font-medium">Severity</th>
              <th className="p-3 font-medium">Camera</th>
              <th className="p-3 font-medium">Handled by</th>
              <th className="p-3 font-medium">Time to resolve</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {alerts.slice(0, limit).map(a => (
              <tr key={a.id} className="border-b last:border-0">
                <td className="whitespace-nowrap p-3 text-xs tabular">{new Date(a.createdAt).toLocaleString('en-MY', { hour12: false })}</td>
                <td className="p-3">{DETECTION_CLASSES[a.detectionClass].label}</td>
                <td className="p-3">
                  <SeverityBadge severity={a.severity} />
                </td>
                <td className="p-3 text-xs">{a.cameraName}</td>
                <td className="p-3 text-xs">{nameOf(a.dispatchedTo)}</td>
                <td className="p-3 text-xs tabular">
                  {a.resolvedAt ? formatDistanceStrict(new Date(a.resolvedAt), new Date(a.createdAt)) : '-'}
                </td>
                <td className="whitespace-nowrap p-3 text-right">
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => onSnapshot(a)} aria-label={`View snapshot for ${a.id}`}>
                    <ImageIcon className="h-4 w-4" aria-hidden />
                  </Button>
                  <ReportButton compact alert={a} ticket={tickets.find(t => t.id === a.ticketId)} />
                  <Button size="sm" variant="outline" className="ml-2" onClick={() => reopenAlert(a.id)}>
                    <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
                    Re-open
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {alerts.length > limit && (
          <div className="p-3 text-center border-t">
            <Button variant="ghost" size="sm" onClick={() => setLimit(l => l + 25)}>
              Show more ({alerts.length - limit} remaining)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SnapshotDialog({ alert, onClose }: { alert: Alert | null; onClose: () => void }) {
  const { cameras } = useAnomaly();
  const camera = alert ? cameras.find(c => c.id === alert.cameraId) : undefined;
  return (
    <Dialog open={!!alert} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw]">
        {alert && camera && (
          <>
            <DialogHeader>
              <DialogTitle>
                {DETECTION_CLASSES[alert.detectionClass].label} · {alert.cameraName}
              </DialogTitle>
              <DialogDescription>{alert.message}</DialogDescription>
            </DialogHeader>
            <AlertSnapshot alert={alert} camera={camera} audited />
            <p className="text-xs text-muted-foreground">
              {alert.snapshot
                ? 'Evidence snapshots are always anonymised: faces were blurred on the edge node before the image left it. Viewing and exporting are logged in the audit trail with your name.'
                : 'Simulated alert: no camera frame exists, so this is a reconstructed scene with heads anonymised.'}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
