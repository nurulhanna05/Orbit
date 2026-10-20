"use client"

import { useState } from 'react';
import { FileText } from 'lucide-react';
import type { Alert, AppSettings, Asset, Camera, Ticket } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { useToast } from '@/hooks/use-toast';
import { DETECTION_CLASSES, SEVERITY_META, ZONE_LABELS } from '@/lib/anomaly/taxonomy';
import { nameOf } from '@/lib/anomaly/seed';
import { afterPhotoKey, downloadBlob, getSnapshot } from '@/lib/anomaly/snapshot-store';
import type { ReportImage, ReportInput } from '@/lib/anomaly/report';
import { sceneToPng } from './scene-image';
import { cn } from '@/lib/utils';
import { OrbitSpinner } from '@/components/ui/orbit-spinner';

type Missing = { missing: string };

async function toImage(blob: Blob, caption: string): Promise<ReportImage> {
  const bitmap = await createImageBitmap(blob);
  const image: ReportImage = {
    data: await blob.arrayBuffer(),
    type: blob.type === 'image/png' ? 'png' : 'jpg',
    width: bitmap.width,
    height: bitmap.height,
    caption,
  };
  bitmap.close();
  return image;
}

async function beforeImage(alert: Alert | undefined, camera: Camera | undefined, when: (iso?: string) => string): Promise<ReportImage | Missing> {
  if (!alert) return { missing: 'No alert is linked to this ticket.' };
  const snapshot = alert.snapshot;
  if (!snapshot) {
    if (!camera) return { missing: 'The camera for this alert no longer exists.' };
    const png = await sceneToPng(camera, alert.boxes, new Set([alert.detectionClass]));
    return toImage(png, `Simulated scene, heads anonymised. ${camera.name}, ${when(alert.createdAt)}.`);
  }
  if (snapshot.status === 'deleted') return { missing: `Deleted under the retention policy on ${when(snapshot.deletedAt)}.` };
  if (snapshot.status === 'unavailable') return { missing: 'The frame could not be anonymised, so no image was kept.' };
  if (snapshot.status === 'processing') return { missing: 'The snapshot is still being anonymised.' };
  const blob = await getSnapshot(alert.id);
  if (!blob) return { missing: 'The snapshot is not stored in this browser.' };
  return toImage(blob, `Anonymised at edge. ${camera?.name ?? alert.cameraName}, captured ${when(snapshot.capturedAt)}.`);
}

async function afterImage(ticket: Ticket | undefined, camera: Camera | undefined, when: (iso?: string) => string): Promise<ReportImage | Missing> {
  if (!ticket) return { missing: 'No maintenance ticket was raised, so there is no after-fix photo.' };
  const photo = ticket.afterPhoto;
  if (!photo) return { missing: 'No after-fix photo was attached when the ticket was resolved.' };
  if (photo.status === 'deleted') return { missing: `Deleted under the retention policy on ${when(photo.deletedAt)}.` };
  if (photo.source === 'simulated') {
    if (!camera) return { missing: 'The camera for this ticket no longer exists.' };
    const png = await sceneToPng(camera, [], new Set());
    return toImage(png, `Simulated after-fix frame. ${camera.name}, ${when(photo.capturedAt)}.`);
  }
  const blob = await getSnapshot(afterPhotoKey(ticket.id));
  if (!blob) return { missing: 'The after-fix photo is not stored in this browser.' };
  return toImage(blob, `Anonymised at edge. Taken ${when(photo.capturedAt)}.`);
}

// Everything in the report is a display name: contractors, cameras and assets never appear by internal id.
export async function prepareReport(
  { alert, ticket, cameras, assets, settings }: { alert?: Alert; ticket?: Ticket; cameras: Camera[]; assets: Asset[]; settings: AppSettings }
): Promise<ReportInput> {
  const fmt = new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: settings.timezone,
    timeZoneName: 'short',
  });
  const when = (iso?: string) => (iso ? fmt.format(new Date(iso)) : 'Not provided');
  const camera = cameras.find(c => c.id === alert?.cameraId);
  const asset = assets.find(a => a.id === alert?.assetId);
  const cls = DETECTION_CLASSES[(alert ?? ticket)!.detectionClass];
  const dispatchedAt = alert?.history.find(h => h.action.startsWith('Dispatched'))?.at ?? ticket?.createdAt;
  const contractorId = ticket?.contractorId ?? alert?.dispatchedTo;
  const [before, after] = await Promise.all([beforeImage(alert, camera, when), afterImage(ticket, camera, when)]);
  const now = new Date();
  return {
    reportId: `RPT-${now.getTime().toString(36).toUpperCase()}`,
    title: `${cls.label}: ${camera?.location ?? ticket?.location ?? 'Unknown location'}`,
    township: settings.township,
    fields: [
      ['Ticket ID', ticket?.id ?? 'No ticket raised'],
      ['Alert ID', alert?.id ?? 'No alert linked'],
      ['Class', cls.label],
      ['Severity', SEVERITY_META[alert?.severity ?? ticket!.priority].label],
      ['Detected', when(alert?.createdAt)],
      ['Dispatched', when(dispatchedAt)],
      ['Resolved', when(ticket?.resolvedAt ?? alert?.resolvedAt)],
      ['Zone', alert ? ZONE_LABELS[alert.zone] : 'Not provided'],
      ['Camera', camera?.name ?? alert?.cameraName ?? 'Not provided'],
      ['Location', camera?.location ?? ticket?.location ?? 'Not provided'],
      ['Asset', asset?.name ?? 'Not provided'],
      ['Contractor', contractorId ? nameOf(contractorId) : 'Not provided'],
      ['Resolution notes', ticket?.notes ?? 'Not provided'],
    ],
    before,
    after,
    generatedAt: fmt.format(now),
  };
}

export const REPORT_RETENTION_NOTE =
  'Exported reports are copies outside the retention policy: their images are not deleted automatically. Store them securely.';

// "Download report (.docx)" for a resolved ticket or alert. Generated in the browser; the export is audited.
export function ReportButton({ alert, ticket, className, compact = false }: { alert?: Alert; ticket?: Ticket; className?: string; compact?: boolean }) {
  const { cameras, assets, settings, logReportExport } = useAnomaly();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const [{ buildReport }, input] = await Promise.all([
        import('@/lib/anomaly/report'),
        prepareReport({ alert, ticket, cameras, assets, settings }),
      ]);
      const blob = await buildReport(input);
      downloadBlob(`orbit-report-${ticket?.id ?? alert?.id}.docx`, blob);
      logReportExport(input.reportId, [ticket?.id, alert?.id].filter(Boolean).join(' / '));
      toast({ title: `Report ${input.reportId} downloaded`, description: REPORT_RETENTION_NOTE });
    } catch (error) {
      console.error('Report not generated:', error);
      toast({ variant: 'destructive', title: 'Report not generated', description: 'Something went wrong building the document. Nothing was exported.' });
    } finally {
      setBusy(false);
    }
  };

  const label = 'Download report (.docx)';
  return compact ? (
    <Button size="icon" variant="ghost" className={cn('h-9 w-9', className)} onClick={download} disabled={busy} aria-label={label} title={label}>
      {busy ? <OrbitSpinner /> : <FileText className="h-4 w-4" aria-hidden />}
    </Button>
  ) : (
    <Button size="sm" variant="outline" className={cn('h-8', className)} onClick={download} disabled={busy}>
      {busy ? <OrbitSpinner className="mr-2" /> : <FileText className="mr-2 h-4 w-4" aria-hidden />}
      {label}
    </Button>
  );
}
