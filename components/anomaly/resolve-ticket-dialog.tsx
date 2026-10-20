"use client"

import { useEffect, useRef, useState } from 'react';
import { Camera as CameraIcon, CheckCircle2, ImageOff, Loader2, ShieldCheck, Upload, X } from 'lucide-react';
import type { Ticket } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { SnapshotInput, anonymisePhoto, isLiveBackend } from '@/lib/anomaly/api';
import { afterPhotoKey, getSnapshot } from '@/lib/anomaly/snapshot-store';
import { ZoneScene } from './zone-feed';

const NO_HAZARDS = new Set<never>();

const frame = (children: React.ReactNode) => (
  <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">{children}</div>
);
const chip = (children: React.ReactNode) => (
  <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-2xs text-white">{children}</span>
);

// Resolving a ticket: resolution notes plus an optional after-fix photo. A real photo is sent to the edge
// service and only its anonymised copy is ever shown or kept; the original is never previewed or stored.
// If anonymisation fails, the photo is discarded (fail closed). Without a backend the photo is the
// simulated scene of the repaired site.
export function ResolveTicketDialog({ ticket, onClose }: { ticket: Ticket | null; onClose: () => void }) {
  const { alerts, cameras, resolveTicket } = useAnomaly();
  const live = isLiveBackend();
  const camera = cameras.find(c => c.id === alerts.find(a => a.id === ticket?.alertId)?.cameraId);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<SnapshotInput | 'simulated' | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<'anonymising' | 'saving' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);

  // Fresh form for each ticket; without a backend the simulated frame is attached by default.
  // Keyed on ids only: camera objects change every few seconds as crowd counts drift.
  const hasCamera = !!camera;
  useEffect(() => {
    setNotes('');
    setError(null);
    setBusy(null);
    setPhoto(ticket && !live && hasCamera ? 'simulated' : null);
  }, [ticket?.id, live, hasCamera]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!photo || photo === 'simulated') return setPreview(null);
    const url = URL.createObjectURL(photo.jpeg);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setPhoto(null);
    setBusy('anonymising');
    try {
      setPhoto(await anonymisePhoto(file));
    } catch (err) {
      setError(`${err instanceof Error ? err.message : 'The photo could not be anonymised.'} Nothing was kept.`);
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!ticket) return;
    setBusy('saving');
    await resolveTicket(ticket.id, { notes, photo });
    setBusy(null);
    onClose();
  };

  return (
    <Dialog open={!!ticket} onOpenChange={o => !o && !busy && onClose()}>
      <DialogContent className="w-[95vw] max-w-lg">
        {ticket && (
          <>
            <DialogHeader>
              <DialogTitle>Resolve {ticket.id}</DialogTitle>
              <DialogDescription>{ticket.title}</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="resolution-notes">Resolution notes</Label>
              <Textarea
                id="resolution-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="What was done, parts replaced, anything to follow up"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">After-fix photo</p>
              {busy === 'anonymising' ? (
                frame(
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
                    <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                    <p className="text-sm">Anonymising photo…</p>
                  </div>
                )
              ) : photo === 'simulated' && camera ? (
                frame(
                  <>
                    <ZoneScene camera={{ ...camera, status: 'online' }} boxes={[]} active={NO_HAZARDS} privacy />
                    {chip('Simulated')}
                  </>
                )
              ) : preview ? (
                frame(
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt={`Anonymised after-fix photo for ${ticket.id}`} className="absolute inset-0 h-full w-full object-contain" />
                    {chip(
                      <>
                        <ShieldCheck className="h-3 w-3" aria-hidden /> Anonymised at edge
                      </>
                    )}
                  </>
                )
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  <ImageOff className="h-4 w-4 shrink-0" aria-hidden />
                  No photo attached. The report will say &quot;Not provided&quot;.
                </div>
              )}

              {error && (
                <p role="alert" className="text-xs text-critical-fg">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {live ? (
                  <>
                    <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
                    <input ref={captureRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
                    <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => uploadRef.current?.click()}>
                      <Upload className="mr-2 h-4 w-4" aria-hidden /> Upload photo
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => captureRef.current?.click()}>
                      <CameraIcon className="mr-2 h-4 w-4" aria-hidden /> Take photo
                    </Button>
                  </>
                ) : (
                  camera &&
                  photo !== 'simulated' && (
                    <Button type="button" size="sm" variant="outline" onClick={() => setPhoto('simulated')}>
                      <CameraIcon className="mr-2 h-4 w-4" aria-hidden /> Use simulated frame
                    </Button>
                  )
                )}
                {photo && (
                  <Button type="button" size="sm" variant="ghost" disabled={!!busy} onClick={() => setPhoto(null)}>
                    <X className="mr-2 h-4 w-4" aria-hidden /> Remove photo
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {live
                  ? 'Photos are sent to the detection service and blurred like evidence snapshots. Only the anonymised copy is kept, under the same retention policy; if blurring fails, the photo is discarded. Take photo opens the camera on phones and tablets.'
                  : 'No detection service is connected, so photos cannot be anonymised. The simulated scene of the repaired site is used instead; no image is stored.'}
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={!!busy}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={!!busy}>
                {busy === 'saving' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />}
                Mark resolved
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// The after-fix photo of a resolved ticket. Opening a stored photo is written to the audit trail.
export function AfterPhotoDialog({ ticket, onClose }: { ticket: Ticket | null; onClose: () => void }) {
  const { alerts, cameras, logAfterPhotoAccess } = useAnomaly();
  const camera = cameras.find(c => c.id === alerts.find(a => a.id === ticket?.alertId)?.cameraId);
  const photo = ticket?.afterPhoto;
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setUrl(null);
    setMissing(false);
    if (!ticket || photo?.source !== 'edge' || photo.status !== 'ready') return;
    let cancelled = false;
    let objectUrl: string | null = null;
    getSnapshot(afterPhotoKey(ticket.id))
      .then(b => {
        if (cancelled) return;
        if (!b) return setMissing(true);
        objectUrl = URL.createObjectURL(b);
        setUrl(objectUrl);
        logAfterPhotoAccess(ticket.id, 'viewed');
      })
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ticket?.id, photo?.source, photo?.status, logAfterPhotoAccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const notice = (text: string) =>
    frame(<p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">{text}</p>);

  return (
    <Dialog open={!!ticket} onOpenChange={o => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-2xl">
        {ticket && (
          <>
            <DialogHeader>
              <DialogTitle>After-fix photo · {ticket.id}</DialogTitle>
              <DialogDescription>{ticket.title}</DialogDescription>
            </DialogHeader>
            {!photo
              ? notice('No after-fix photo was attached.')
              : photo.status === 'deleted'
                ? notice('Deleted under the retention policy.')
                : photo.source === 'simulated'
                  ? camera
                    ? frame(
                        <>
                          <ZoneScene camera={{ ...camera, status: 'online' }} boxes={[]} active={NO_HAZARDS} privacy />
                          {chip('Simulated')}
                        </>
                      )
                    : notice('The camera for this ticket no longer exists.')
                  : missing
                    ? notice('The photo is not stored in this browser.')
                    : url
                      ? frame(
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={`Anonymised after-fix photo for ${ticket.id}`} className="absolute inset-0 h-full w-full object-contain" />
                            {chip(
                              <>
                                <ShieldCheck className="h-3 w-3" aria-hidden /> Anonymised at edge
                              </>
                            )}
                          </>
                        )
                      : notice('Loading photo…')}
            {ticket.notes && (
              <p className="text-sm">
                <span className="font-medium">Resolution notes: </span>
                {ticket.notes}
              </p>
            )}
            <p className="text-xs text-muted-foreground">Viewing a stored photo is logged in the audit trail with your name.</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
