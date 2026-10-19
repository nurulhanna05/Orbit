"use client"

import { ShieldCheck } from 'lucide-react';
import type { AuditEntry } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAnomaly } from '@/components/providers/anomaly-provider';

export const PRIVACY_STATUS = 'Evidence snapshots are always anonymised.';

export function AuditEntryText({ entry }: { entry: AuditEntry }) {
  return (
    <>
      {entry.text}
      {entry.actor && <span className="text-muted-foreground"> · {entry.actor}</span>}
    </>
  );
}

// Read-only privacy status. There is nothing to switch: anonymising stored evidence is not optional.
export function PrivacyStatusBadge({ compact = false }: { compact?: boolean }) {
  const { audit, settings } = useAnomaly();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex h-9 items-center gap-2 rounded-md border border-foreground/20 bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent max-md:min-h-11 max-md:min-w-11 max-md:justify-center"
          aria-label={compact ? `Privacy: ${PRIVACY_STATUS}` : undefined}
        >
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
          <span className={compact ? 'sr-only sm:not-sr-only' : undefined}>{compact ? 'Snapshots anonymised' : PRIVACY_STATUS}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)]" align="end">
        <div className="space-y-3">
          <div>
            <p className="font-medium text-sm">Privacy-by-design, aligned with PDPA principles</p>
            <p className="text-xs text-muted-foreground">{PRIVACY_STATUS}</p>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>Live view is transient and for authorised operators only. It is not recorded.</li>
            <li>When an alert opens, one frame is kept, with faces blurred on the edge node</li>
            <li>
              Snapshots are deleted after {settings.snapshotRetentionDays} days, or {settings.resolvedSnapshotRetentionDays}{' '}
              days after the alert is resolved
            </li>
            <li>Viewing or exporting a snapshot is logged with the operator&apos;s name</li>
          </ul>
          <div className="border-t pt-2">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Audit trail</p>
            <div className="max-h-28 overflow-y-auto space-y-1">
              {audit.slice(0, 6).map(entry => (
                <p key={entry.id} className="text-xs leading-snug">
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
