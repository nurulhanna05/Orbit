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
        <button className="flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <ShieldCheck className="h-4 w-4" />
          <span>{compact ? 'Snapshots anonymised' : PRIVACY_STATUS}</span>
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
