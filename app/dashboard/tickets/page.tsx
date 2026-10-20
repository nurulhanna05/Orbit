"use client"

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, CheckCircle2, CircleCheck, HardHat, Image as ImageIcon, Phone, RotateCcw, Truck, Wrench } from 'lucide-react';
import type { Ticket, TicketStatus } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { CONTRACTORS, nameOf } from '@/lib/anomaly/seed';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { SeverityBadge } from '@/components/anomaly/status';
import { AfterPhotoDialog, ResolveTicketDialog } from '@/components/anomaly/resolve-ticket-dialog';
import { REPORT_RETENTION_NOTE, ReportButton } from '@/components/anomaly/report-button';

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
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [showAllResolved, setShowAllResolved] = useState(false);

  useEffect(() => {
    setFocus(new URLSearchParams(window.location.search).get('focus'));
  }, []);

  const byStatus = (s: TicketStatus) =>
    tickets
      .filter(t => t.status === s)
      .sort((a, b) => (b.resolvedAt ?? b.createdAt).localeCompare(a.resolvedAt ?? a.createdAt));

  return (
    <div className="mx-auto max-w-[1600px] space-y-6" data-tick={tick}>
      <PageHeader
        title="Maintenance Tickets"
        description="Which work orders are open, who has them, and how far along they are."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map(col => {
          const items = byStatus(col.status);
          const shown = col.status === 'resolved' && !showAllResolved ? items.slice(0, 6) : items;
          const Icon = col.icon;
          return (
            <section key={col.status} aria-label={col.title} className="rounded-lg border bg-muted p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Icon className="h-4 w-4" aria-hidden />
                  {col.title}
                </h2>
                <Badge variant="outline" className="bg-card">{items.length}</Badge>
              </div>
              {col.status === 'resolved' && items.length > 0 && (
                <p className="mb-3 text-xs text-muted-foreground">{REPORT_RETENTION_NOTE}</p>
              )}
              <div className="space-y-3">
                {shown.map(t => (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    highlighted={focus === t.id}
                    onResolve={() => setResolvingId(t.id)}
                    onPhoto={() => setPhotoId(t.id)}
                  />
                ))}
                {items.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No tickets</p>}
                {col.status === 'resolved' && items.length > 6 && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAllResolved(s => !s)}>
                    {showAllResolved ? 'Show fewer' : `Show all ${items.length}`}
                  </Button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <ContractorStrip />
      <ResolveTicketDialog ticket={tickets.find(t => t.id === resolvingId) ?? null} onClose={() => setResolvingId(null)} />
      <AfterPhotoDialog ticket={tickets.find(t => t.id === photoId) ?? null} onClose={() => setPhotoId(null)} />
    </div>
  );
}

function ContractorStrip() {
  const { tickets } = useAnomaly();
  return (
    <section aria-labelledby="crews-heading" className="space-y-3">
      <h2 id="crews-heading" className="text-base font-semibold">Contractor crews</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {CONTRACTORS.map(c => {
        const active = tickets.filter(t => t.contractorId === c.id && t.status !== 'resolved');
        const done = tickets.filter(t => t.contractorId === c.id && t.status === 'resolved').length;
        return (
          <Card key={c.id}>
            <CardHeader className="p-4 pb-1">
              <CardTitle as="h3" className="flex items-center gap-2 text-sm">
                <HardHat className="h-4 w-4 text-muted-foreground" aria-hidden />
                {c.name}
              </CardTitle>
              <CardDescription className="text-xs">{c.trade}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 p-4 pt-1 text-xs">
              <p className={cn('flex items-center gap-2 font-medium', !active.length && 'text-success-fg')}>
                {active.length ? <Truck className="h-4 w-4" aria-hidden /> : <CircleCheck className="h-4 w-4" aria-hidden />}
                {active.length ? `${active.length} active job${active.length > 1 ? 's' : ''}` : 'Available'}
              </p>
              <p className="text-muted-foreground tabular">
                {done} completed · about {c.etaMins} min to arrive
              </p>
              <p className="flex items-center gap-1 text-muted-foreground tabular">
                <Phone className="h-3 w-3" aria-hidden /> {c.hotline}
              </p>
            </CardContent>
          </Card>
        );
      })}
      </div>
    </section>
  );
}

function TicketCard({ ticket, highlighted, onResolve, onPhoto }: { ticket: Ticket; highlighted: boolean; onResolve: () => void; onPhoto: () => void }) {
  const { alerts, setTicketStatus, reassignTicket } = useAnomaly();
  const alert = alerts.find(a => a.id === ticket.alertId);
  const status = fieldStatus(ticket);

  return (
    <Card className={cn(highlighted && 'ring-2 ring-ring ring-offset-2 ring-offset-muted')}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold leading-snug">{ticket.title}</h3>
            <p className="text-xs text-muted-foreground">
              Ticket <span className="font-mono">{ticket.id}</span>
              {ticket.alertId && (
                <>
                  {' · from alert '}
                  <Link className="font-mono text-link underline underline-offset-2" href={`/dashboard/alerts?focus=${ticket.alertId}`}>
                    {ticket.alertId}
                  </Link>
                </>
              )}
            </p>
          </div>
          <SeverityBadge severity={ticket.priority} />
        </div>

        <div className="space-y-1">
          <p className="text-xs">{status.label}</p>
          <Progress value={status.progress} aria-label="Work progress" />
        </div>

        {ticket.status !== 'resolved' ? (
          <Select value={ticket.contractorId} onValueChange={v => reassignTicket(ticket.id, v)}>
            <SelectTrigger className="h-9 text-xs" aria-label="Assigned contractor">
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
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(ticket.resolvedAt ?? ticket.createdAt), { addSuffix: true })}
          </span>
          <div className="flex gap-2">
            {ticket.status === 'open' && (
              <Button size="sm" variant="outline" className="h-8" onClick={() => setTicketStatus(ticket.id, 'in_progress')}>
                Start work <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            )}
            {ticket.status === 'in_progress' && (
              <Button size="sm" variant="outline" className="h-8" onClick={onResolve}>
                Mark resolved <CheckCircle2 className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            )}
            {ticket.status === 'resolved' && (
              <Button size="sm" variant="outline" className="h-8" onClick={() => setTicketStatus(ticket.id, 'open')}>
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden /> Re-open
              </Button>
            )}
          </div>
        </div>

        {ticket.status === 'resolved' && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <ReportButton ticket={ticket} alert={alert} />
            {ticket.afterPhoto && (
              <Button size="sm" variant="ghost" className="h-8" onClick={onPhoto}>
                <ImageIcon className="mr-2 h-4 w-4" aria-hidden /> After photo
              </Button>
            )}
          </div>
        )}

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none rounded-sm py-1 max-md:py-3">Activity ({ticket.log.length})</summary>
          <ol className="mt-1 space-y-1 border-l pl-3">
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
