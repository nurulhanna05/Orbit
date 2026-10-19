"use client"

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceStrict, formatDistanceToNow } from 'date-fns';
import { CheckCircle2, ChevronDown, Image as ImageIcon, Loader2, RotateCcw, Search, Send, Ticket } from 'lucide-react';
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
import { SimulateMenu } from '@/components/anomaly/simulate-menu';
import { AlertSnapshot } from '@/components/anomaly/alert-snapshot';
import { CONTRACTORS, nameOf } from '@/lib/anomaly/seed';
import { DETECTION_CLASSES, DETECTION_CLASS_LIST, SEVERITY_META, ZONE_LABELS } from '@/lib/anomaly/taxonomy';
import { cn } from '@/lib/utils';

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
    <div className="container mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alert Centre</h1>
          <p className="text-muted-foreground">
            Operational and maintenance anomalies across the township. Dispatch crews, raise tickets, and close the loop.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={markAllAlertsRead}>
            Mark all read
          </Button>
          <SimulateMenu />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-xl">
        {(['critical', 'warning', 'info'] as Severity[]).map(s => (
          <button
            key={s}
            onClick={() => setSeverity(severity === s ? 'all' : s)}
            className={cn('rounded-lg border p-3 text-left transition-colors', SEVERITY_META[s].badge, severity === s && 'ring-2 ring-offset-1 ring-current')}
          >
            <p className="text-xs font-medium">{SEVERITY_META[s].label}</p>
            <p className="text-2xl font-bold tabular-nums">{countBy(s)}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search camera, message or ID…" className="pl-8" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <ToggleGroup type="single" value={severity} onValueChange={v => setSeverity((v || 'all') as Severity | 'all')} className="justify-start">
          <ToggleGroupItem value="all" size="sm">All</ToggleGroupItem>
          <ToggleGroupItem value="critical" size="sm">Critical</ToggleGroupItem>
          <ToggleGroupItem value="warning" size="sm">Warning</ToggleGroupItem>
          <ToggleGroupItem value="info" size="sm">Info</ToggleGroupItem>
        </ToggleGroup>
        <Select value={cls} onValueChange={v => setCls(v as DetectionClass | 'all')}>
          <SelectTrigger className="w-[200px]">
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
        <TabsContent value="open" className="space-y-3 mt-4">
          {open.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                No open anomalies. Use “Simulate incident” to run the demo flow.
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
  const { dispatchAlert, resolveAlert, createTicketFromAlert, markAlertRead } = useAnomaly();
  const [expanded, setExpanded] = useState(highlighted);
  const meta = DETECTION_CLASSES[alert.detectionClass];
  const recommended = CONTRACTORS.filter(c => c.handles.includes(alert.detectionClass));
  const others = CONTRACTORS.filter(c => !c.handles.includes(alert.detectionClass));

  useEffect(() => {
    if (highlighted) markAlertRead(alert.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlighted]);

  return (
    <Card className={cn('overflow-hidden border-l-4', highlighted && 'ring-2 ring-emerald-500', !alert.read && 'bg-muted/30')} style={{ borderLeftColor: meta.color }}>
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{meta.label}</span>
              <Badge variant="outline" className={SEVERITY_META[alert.severity].badge}>
                {SEVERITY_META[alert.severity].label}
              </Badge>
              {alert.status === 'dispatched' ? (
                <Badge variant="secondary">Dispatched · {nameOf(alert.dispatchedTo)}</Badge>
              ) : (
                <Badge variant="outline">Awaiting action</Badge>
              )}
              {alert.ticketId && (
                <Badge variant="outline" className="font-mono">
                  {alert.ticketId}
                </Badge>
              )}
              {!alert.read && <span className="h-2 w-2 rounded-full bg-emerald-500" title="Unread" />}
            </div>
            <p className="text-sm mt-1">{alert.message}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {alert.cameraName} ({alert.cameraId}) · {ZONE_LABELS[alert.zone]} · conf {alert.confidence.toFixed(2)} ·{' '}
              {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })} · <span className="font-mono">{alert.id}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={onSnapshot}>
              {alert.snapshot?.status === 'processing' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Snapshot…
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4 mr-1.5" />
                  {alert.snapshot ? 'Snapshot' : 'Frame'}
                </>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Send className="h-4 w-4 mr-1.5" />
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
                  <Ticket className="h-4 w-4 mr-1.5" />
                  View ticket
                </Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => createTicketFromAlert(alert.id)}>
                <Ticket className="h-4 w-4 mr-1.5" />
                Raise ticket
              </Button>
            )}
            <Button size="sm" onClick={() => resolveAlert(alert.id)}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Resolve
            </Button>
            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setExpanded(e => !e)} title="Timeline">
              <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
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
      </CardContent>
    </Card>
  );
}

function HistoryTable({ alerts, onSnapshot }: { alerts: Alert[]; onSnapshot: (a: Alert) => void }) {
  const { reopenAlert } = useAnomaly();
  const [limit, setLimit] = useState(25);
  if (alerts.length === 0) return <p className="text-sm text-muted-foreground">No resolved alerts match these filters.</p>;

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
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
                <td className="p-3 whitespace-nowrap text-xs">{new Date(a.createdAt).toLocaleString('en-MY', { hour12: false })}</td>
                <td className="p-3">{DETECTION_CLASSES[a.detectionClass].label}</td>
                <td className="p-3">
                  <Badge variant="outline" className={SEVERITY_META[a.severity].badge}>
                    {SEVERITY_META[a.severity].label}
                  </Badge>
                </td>
                <td className="p-3 text-xs">{a.cameraName}</td>
                <td className="p-3 text-xs">{nameOf(a.dispatchedTo)}</td>
                <td className="p-3 text-xs">
                  {a.resolvedAt ? formatDistanceStrict(new Date(a.resolvedAt), new Date(a.createdAt)) : '-'}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => onSnapshot(a)}>
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => reopenAlert(a.id)}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
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
