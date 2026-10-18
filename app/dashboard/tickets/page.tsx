"use client"

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, CheckCircle2, HardHat, Phone, RotateCcw, Truck, Wrench } from 'lucide-react';
import type { Ticket, TicketStatus } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { CONTRACTORS, nameOf } from '@/lib/anomaly/seed';
import { DETECTION_CLASSES, SEVERITY_META } from '@/lib/anomaly/taxonomy';
import { cn } from '@/lib/utils';

// Demo clock: crews travel 20x faster than real time so the board visibly moves during a pitch.
const DEMO_SPEED = 20;

const COLUMNS: { status: TicketStatus; title: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { status: 'open', title: 'Open', icon: Wrench },
  { status: 'in_progress', title: 'In progress', icon: Truck },
  { status: 'resolved', title: 'Resolved', icon: CheckCircle2 },
];

function fieldStatus(ticket: Ticket) {
  const contractor = CONTRACTORS.find(c => c.id === ticket.contractorId);
  if (ticket.status === 'open') return { label: 'Awaiting crew acceptance', progress: 5 };
  if (ticket.status === 'resolved') return { label: 'Work completed', progress: 100 };
  const eta = contractor?.etaMins ?? 30;
  const elapsed = ((Date.now() - new Date(ticket.startedAt ?? ticket.createdAt).getTime()) / 60000) * DEMO_SPEED;
  if (elapsed < eta) {
    return { label: `En route · ~${Math.ceil(eta - elapsed)} min away`, progress: 15 + (elapsed / eta) * 45 };
  }
  return { label: 'On site · repair underway', progress: 75 };
}

export default function TicketsPage() {
  const { tickets, tick } = useAnomaly();
  const [focus, setFocus] = useState<string | null>(null);
  const [showAllResolved, setShowAllResolved] = useState(false);

  useEffect(() => {
    setFocus(new URLSearchParams(window.location.search).get('focus'));
  }, []);

  const byStatus = (s: TicketStatus) =>
    tickets
      .filter(t => t.status === s)
      .sort((a, b) => (b.resolvedAt ?? b.createdAt).localeCompare(a.resolvedAt ?? a.createdAt));

  return (
    <div className="container mx-auto space-y-6" data-tick={tick}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Maintenance Tickets</h1>
        <p className="text-muted-foreground">
          Work orders raised from detection triggers and routed to township contractors, with live crew status.
        </p>
      </div>

      <ContractorStrip />

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map(col => {
          const items = byStatus(col.status);
          const shown = col.status === 'resolved' && !showAllResolved ? items.slice(0, 6) : items;
          const Icon = col.icon;
          return (
            <div key={col.status} className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Icon className="h-4 w-4" />
                  {col.title}
                </h2>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <div className="space-y-3">
                {shown.map(t => (
                  <TicketCard key={t.id} ticket={t} highlighted={focus === t.id} />
                ))}
                {items.length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">Nothing here</p>}
                {col.status === 'resolved' && items.length > 6 && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAllResolved(s => !s)}>
                    {showAllResolved ? 'Show fewer' : `Show all ${items.length}`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContractorStrip() {
  const { tickets } = useAnomaly();
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {CONTRACTORS.map(c => {
        const active = tickets.filter(t => t.contractorId === c.id && t.status !== 'resolved');
        const done = tickets.filter(t => t.contractorId === c.id && t.status === 'resolved').length;
        return (
          <Card key={c.id}>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <HardHat className="h-4 w-4 text-amber-500" />
                {c.name}
              </CardTitle>
              <CardDescription className="text-xs">{c.trade}</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-1 text-xs space-y-1">
              <div className="flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', active.length ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500')} />
                {active.length ? `${active.length} active job${active.length > 1 ? 's' : ''}` : 'Available'}
              </div>
              <p className="text-muted-foreground">
                {done} completed · ETA ~{c.etaMins} min
              </p>
              <p className="flex items-center gap-1 text-muted-foreground">
                <Phone className="h-3 w-3" /> {c.hotline}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TicketCard({ ticket, highlighted }: { ticket: Ticket; highlighted: boolean }) {
  const { setTicketStatus, reassignTicket } = useAnomaly();
  const meta = DETECTION_CLASSES[ticket.detectionClass];
  const status = fieldStatus(ticket);

  return (
    <Card className={cn('border-l-4', highlighted && 'ring-2 ring-emerald-500')} style={{ borderLeftColor: meta.color }}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium leading-snug">{ticket.title}</p>
            <p className="text-[11px] text-muted-foreground font-mono">
              {ticket.id}
              {ticket.alertId && (
                <>
                  {' · '}
                  <Link className="underline" href={`/dashboard/alerts?focus=${ticket.alertId}`}>
                    {ticket.alertId}
                  </Link>
                </>
              )}
            </p>
          </div>
          <Badge variant="outline" className={cn('text-[10px]', SEVERITY_META[ticket.priority].badge)}>
            {SEVERITY_META[ticket.priority].label}
          </Badge>
        </div>

        <div className="space-y-1">
          <p className="text-xs">{status.label}</p>
          <Progress value={status.progress} className="h-1.5" />
        </div>

        {ticket.status !== 'resolved' ? (
          <Select value={ticket.contractorId} onValueChange={v => reassignTicket(ticket.id, v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTRACTORS.map(c => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.name}
                  {c.handles.includes(ticket.detectionClass) ? ' (recommended)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs text-muted-foreground">Handled by {nameOf(ticket.contractorId)}</p>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(ticket.resolvedAt ?? ticket.createdAt), { addSuffix: true })}
          </span>
          <div className="flex gap-1">
            {ticket.status === 'open' && (
              <Button size="sm" className="h-7 text-xs" onClick={() => setTicketStatus(ticket.id, 'in_progress')}>
                Start work <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
            {ticket.status === 'in_progress' && (
              <Button size="sm" className="h-7 text-xs" onClick={() => setTicketStatus(ticket.id, 'resolved')}>
                Mark resolved <CheckCircle2 className="h-3 w-3 ml-1" />
              </Button>
            )}
            {ticket.status === 'resolved' && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTicketStatus(ticket.id, 'open')}>
                <RotateCcw className="h-3 w-3 mr-1" /> Re-open
              </Button>
            )}
          </div>
        </div>

        <details className="text-[11px] text-muted-foreground">
          <summary className="cursor-pointer select-none">Activity ({ticket.log.length})</summary>
          <ol className="mt-1 space-y-0.5 border-l pl-2">
            {ticket.log.map((l, i) => (
              <li key={i}>
                {new Date(l.at).toLocaleString('en-MY', { hour12: false })} · {l.action}
              </li>
            ))}
          </ol>
        </details>
      </CardContent>
    </Card>
  );
}
