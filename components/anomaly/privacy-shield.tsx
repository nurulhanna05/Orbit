"use client"

import { useState } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuditEntry } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAnomaly } from '@/components/providers/anomaly-provider';

// The only control that changes the shield: switching it off always goes through the confirm dialog.
export function PrivacyShieldSwitch({ id }: { id?: string }) {
  const { settings, setPrivacyShield } = useAnomaly();
  const [confirmOff, setConfirmOff] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <>
      <Switch
        id={id}
        aria-label="PDPA Privacy Shield"
        checked={settings.privacyShield}
        onCheckedChange={checked => (checked ? setPrivacyShield(true) : setConfirmOff(true))}
      />
      <AlertDialog
        open={confirmOff}
        onOpenChange={open => {
          setConfirmOff(open);
          if (!open) setReason('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable the Privacy Shield?</AlertDialogTitle>
            <AlertDialogDescription>
              Live feeds will show faces un-blurred so an operator can verify an emergency, such as a fall. This live
              view is never recorded: stored snapshots and exports stay anonymised. Your name and the reason are
              written to the PDPA audit trail. Detection labels stay anonymous either way.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="shield-reason">Reason (logged)</Label>
            <Input
              id="shield-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Verify Person Fallen at CAM-03"
              maxLength={120}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep shield on</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => setPrivacyShield(false, reason.trim() || undefined)}
            >
              Disable and log
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function AuditEntryText({ entry }: { entry: AuditEntry }) {
  return (
    <>
      {entry.text}
      {entry.actor && <span className="text-muted-foreground"> · {entry.actor}</span>}
    </>
  );
}

export function PrivacyShieldBadge({ compact = false }: { compact?: boolean }) {
  const { settings, audit } = useAnomaly();
  const on = settings.privacyShield;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            on
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-300 animate-pulse'
          )}
        >
          {on ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
          {compact ? (
            <span>{on ? 'Shield On' : 'Shield Off'}</span>
          ) : (
            <span>{on ? 'PDPA Privacy Shield Active: faces anonymised' : 'Privacy Shield OFF: live view, audit logged'}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)]" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">PDPA Privacy Shield</p>
              <p className="text-xs text-muted-foreground">
                Blurs faces on live feeds. Stored frames are always anonymised at the edge.
              </p>
            </div>
            <PrivacyShieldSwitch />
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>Detections describe object states and posture, never identity</li>
            <li>Labels are anonymous, e.g. &quot;Pedestrian (Face Blurred) · 0.94&quot;</li>
            <li>Vehicle plates are masked; no face templates are created</li>
          </ul>
          <div className="border-t pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Audit trail</p>
            <div className="max-h-28 overflow-y-auto space-y-1">
              {audit.slice(0, 6).map(entry => (
                <p key={entry.id} className="text-[11px] leading-snug">
                  <span className="text-muted-foreground">{new Date(entry.at).toLocaleString()}:</span>{' '}
                  <AuditEntryText entry={entry} />
                </p>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
