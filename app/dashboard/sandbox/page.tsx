"use client"

import { useEffect, useRef, useState } from 'react';
import { FlaskConical, ImageOff, Loader2, PlayCircle, Send, ShieldCheck, UploadCloud } from 'lucide-react';
import type { Alert, DetectionClass, ZoneType } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { ZoneScene, displayLabel } from '@/components/anomaly/zone-feed';
import { buildAlert, uid } from '@/lib/anomaly/simulator';
import { SnapshotInput, analyseClip, detectionToAlert, isLiveBackend, snapshotInput } from '@/lib/anomaly/api';
import { DETECTION_CLASSES, DETECTION_CLASS_LIST, SEVERITY_META, ZONE_CLASSES, ZONE_LABELS } from '@/lib/anomaly/taxonomy';
import { PageHeader } from '@/components/layout/page-header';
import { SeverityBadge, SeverityIcon, StatusBadge, TONE_FILL, TONE_OVERLAY } from '@/components/anomaly/status';
import { cn } from '@/lib/utils';

// `snapshot` is the edge service's anonymised frame for a backend detection: null when it sent metadata
// only, undefined for simulated detections, which have no frame at all.
type SandboxEvent = { id: string; at: number; alert: Alert; pushed: boolean; snapshot?: SnapshotInput | null; snapshotUrl?: string };

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function SnapshotThumb({ ev, className }: { ev: SandboxEvent; className?: string }) {
  if (ev.snapshotUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={ev.snapshotUrl} alt={`Anonymised snapshot at ${fmt(ev.at)}`} className={`rounded border object-cover ${className ?? ''}`} />
    );
  }
  return (
    <div className={`flex items-center justify-center rounded border bg-muted text-xs text-muted-foreground ${className ?? ''}`}>
      {ev.snapshot === null ? <ImageOff className="h-4 w-4" aria-label="No snapshot" /> : 'Simulated'}
    </div>
  );
}

export default function SandboxPage() {
  const { cameras, ingestAlert } = useAnomaly();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(30);
  const [currentTime, setCurrentTime] = useState(0);
  const [zone, setZone] = useState<ZoneType>('jogging_track');
  const [classes, setClasses] = useState<DetectionClass[]>(ZONE_CLASSES.jogging_track);
  const [threshold, setThreshold] = useState(0.6);
  const [targetCamera, setTargetCamera] = useState(cameras[0]?.id ?? '');
  const [processing, setProcessing] = useState(false);
  const [events, setEvents] = useState<SandboxEvent[] | null>(null);

  const profileCamera = { ...(cameras.find(c => c.zone === zone) ?? cameras[0]), zone, status: 'online' as const, confidenceThreshold: threshold };
  const active = events?.filter(e => currentTime >= e.at && currentTime < e.at + 4) ?? [];
  const mockMode = !isLiveBackend();

  // Snapshot thumbnails are object URLs; release them when the result set is replaced or the page closes.
  const eventsRef = useRef<SandboxEvent[] | null>(null);
  eventsRef.current = events;
  const releaseSnapshots = () => eventsRef.current?.forEach(e => e.snapshotUrl && URL.revokeObjectURL(e.snapshotUrl));
  useEffect(() => () => eventsRef.current?.forEach(e => e.snapshotUrl && URL.revokeObjectURL(e.snapshotUrl)), []);

  const clearClip = () => {
    setVideoUrl(url => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    releaseSnapshots();
    setEvents(null);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.includes('video/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please upload a video clip (mp4, webm, mov).' });
      return;
    }
    clearClip();
    setFile(f);
    setVideoUrl(URL.createObjectURL(f));
  };

  const run = async () => {
    setProcessing(true);
    releaseSnapshots();
    setEvents(null);
    try {
      const camera = cameras.find(c => c.id === targetCamera) ?? profileCamera;
      const live = file ? await analyseClip(file, classes, threshold) : null;
      let result: SandboxEvent[];
      if (live) {
        result = live.map(d => {
          const snapshot = snapshotInput(d);
          return {
            id: uid('SBX'),
            at: (new Date(d.timestamp).getTime() / 1000) % duration,
            alert: { ...detectionToAlert(d, camera), source: 'sandbox' },
            pushed: false,
            snapshot,
            snapshotUrl: snapshot ? URL.createObjectURL(snapshot.jpeg) : undefined,
          };
        });
      } else {
        // Mock inference: one or two hits per selected class, spread across the clip.
        await new Promise(r => setTimeout(r, 1800));
        result = classes.flatMap((cls, i) =>
          Array.from({ length: 1 + (i % 2) }, (_, j) => {
            const at = ((i * 0.17 + j * 0.41 + 0.05) % 0.9) * duration;
            const alert = buildAlert({ ...profileCamera, id: camera.id, name: camera.name, location: camera.location }, cls, {
              source: 'sandbox',
            });
            return { id: uid('SBX'), at, alert, pushed: false };
          })
        );
      }
      result.sort((a, b) => a.at - b.at);
      setEvents(result);
      const snaps = result.filter(e => e.snapshot).length;
      toast({
        title: live ? 'Analysis complete' : 'Simulation complete',
        description: live
          ? `${result.length} detections, ${snaps} with an anonymised snapshot`
          : `${result.length} simulated detections. No model attached, so the clip was not analysed.`,
      });
    } catch (error) {
      console.error('Sandbox analysis failed:', error);
      toast({
        variant: 'destructive',
        title: 'Analysis failed',
        description: error instanceof Error ? error.message : 'The detection service did not respond.',
      });
    } finally {
      setProcessing(false);
    }
  };

  const push = (ev: SandboxEvent) => {
    // The alert appears straight away; its snapshot is stored and attached asynchronously. Simulated
    // detections have no frame, so they carry no snapshot at all.
    const snapshot = ev.snapshot === undefined ? undefined : Promise.resolve(ev.snapshot);
    ingestAlert({ ...ev.alert, createdAt: new Date().toISOString(), id: uid('ALR') }, snapshot);
    setEvents(es => es?.map(e => (e.id === ev.id ? { ...e, pushed: true } : e)) ?? null);
  };

  const seek = (t: number) => {
    setCurrentTime(t);
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageHeader
        title="Model Sandbox"
        description={
          <>
            What would the YOLOv8 model flag in this footage? Your clip plays as is, with boxes and anonymous labels
            overlaid.{' '}
            {mockMode
              ? 'No model is attached yet: detections are simulated and the clip never leaves this browser.'
              : 'The local edge service analyses it without keeping it; only an anonymised snapshot of each detection comes back.'}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Footage</CardTitle>
            <CardDescription>
              {videoUrl ? file?.name : 'Upload an anomaly clip, or run against the sample scene for the selected zone profile.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="absolute inset-0 h-full w-full object-fill"
                  controls
                  onLoadedMetadata={e => setDuration(e.currentTarget.duration || 30)}
                  onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
                />
              ) : (
                <ZoneScene
                  camera={profileCamera}
                  boxes={active.flatMap(e => e.alert.boxes)}
                  active={new Set(active.map(e => e.alert.detectionClass))}
                  privacy={false}
                />
              )}
              {active.flatMap(e =>
                e.alert.boxes.map((b, i) => (
                  <div
                    key={`${e.id}-${i}`}
                    className="pointer-events-none absolute border-2"
                    style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%`, borderColor: TONE_OVERLAY[e.alert.severity].fill }}
                  >
                    <span
                      className="absolute bottom-full left-[-2px] whitespace-nowrap px-1 text-2xs font-medium"
                      style={{ backgroundColor: TONE_OVERLAY[e.alert.severity].fill, color: TONE_OVERLAY[e.alert.severity].text }}
                    >
                      {displayLabel(b, false)}
                    </span>
                  </div>
                ))
              )}
              {videoUrl && mockMode && (
                <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-2xs font-medium text-white">
                  <FlaskConical className="h-3 w-3" aria-hidden /> Simulated detections · clip not analysed
                </span>
              )}
            </div>

            {events && (
              <div className="space-y-1">
                <div className="relative h-8 rounded bg-muted">
                  {events.map(e => (
                    <div key={e.id} className="group absolute top-1 -translate-x-1/2" style={{ left: `${(e.at / duration) * 100}%` }}>
                      {/* 24px hit area around a slim severity-coloured marker; the label says what it is. */}
                      <button
                        aria-label={`${SEVERITY_META[e.alert.severity].label}: ${DETECTION_CLASSES[e.alert.detectionClass].label} at ${fmt(e.at)}. Jump to it`}
                        onClick={() => seek(e.at)}
                        className="flex h-6 w-6 items-center justify-center rounded-sm"
                      >
                        <span className={cn('block h-5 w-1.5 rounded-sm', TONE_FILL[e.alert.severity])} aria-hidden />
                      </button>
                      {/* The anonymised evidence snapshot for this detection, shown on hover and on keyboard focus. */}
                      <div className="pointer-events-none absolute bottom-8 left-1/2 z-10 hidden w-44 -translate-x-1/2 space-y-1 rounded-md border bg-popover p-1 shadow-md group-focus-within:block group-hover:block">
                        <SnapshotThumb ev={e} className="aspect-video w-full" />
                        <p className="px-0.5 text-xs text-popover-foreground">
                          {DETECTION_CLASSES[e.alert.detectionClass].label} · {fmt(e.at)}
                          {e.snapshot && ' · faces blurred'}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className="absolute top-0 h-8 w-0.5 bg-foreground" style={{ left: `${(currentTime / duration) * 100}%` }} aria-hidden />
                </div>
                {!videoUrl && (
                  <Slider aria-label="Playback position" min={0} max={duration} step={0.5} value={[currentTime]} onValueChange={([v]) => setCurrentTime(v)} />
                )}
                <p className="text-xs text-muted-foreground tabular">
                  {fmt(currentTime)} / {fmt(duration)}: point at or tab to a marker for its anonymised snapshot, select it to jump there
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Input type="file" accept="video/*" onChange={handleFile} className="max-w-xs" aria-label="Upload a video clip" />
              {videoUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    clearClip();
                    setFile(null);
                    setDuration(30);
                  }}
                >
                  Use sample scene instead
                </Button>
              )}
              {!videoUrl && <UploadCloud className="h-4 w-4 text-muted-foreground" aria-hidden />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model configuration</CardTitle>
            <CardDescription>{isLiveBackend() ? 'Sent to the FastAPI sandbox endpoint' : 'Mock inference (no backend configured)'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="zone-profile">Zone profile</Label>
              <Select
                value={zone}
                onValueChange={v => {
                  setZone(v as ZoneType);
                  setClasses(ZONE_CLASSES[v as ZoneType]);
                }}
              >
                <SelectTrigger id="zone-profile">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ZONE_LABELS) as ZoneType[]).map(z => (
                    <SelectItem key={z} value={z}>
                      {ZONE_LABELS[z]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">What to look for</p>
              {DETECTION_CLASS_LIST.map(c => (
                <label key={c.id} className="flex items-center gap-3 py-1 text-sm">
                  <Checkbox
                    checked={classes.includes(c.id)}
                    onCheckedChange={v => setClasses(cs => (v ? [...cs, c.id] : cs.filter(x => x !== c.id)))}
                  />
                  <span className="flex-1">{c.label}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <SeverityIcon severity={c.defaultSeverity} className="h-3.5 w-3.5" />
                    {SEVERITY_META[c.defaultSeverity].label}
                  </span>
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label id="sandbox-conf">Minimum confidence</Label>
                <span className="text-sm tabular">{Math.round(threshold * 100)}%</span>
              </div>
              <Slider aria-labelledby="sandbox-conf" min={0.3} max={0.95} step={0.05} value={[threshold]} onValueChange={([v]) => setThreshold(Number(v.toFixed(2)))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-camera">Send pushed alerts as camera</Label>
              <Select value={targetCamera} onValueChange={setTargetCamera}>
                <SelectTrigger id="target-camera">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.id} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" disabled={processing || classes.length === 0} onClick={run}>
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Running analysis…
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-4 w-4" aria-hidden /> Run analysis
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {events && (
        <Card>
          <CardHeader>
            <CardTitle>Detections</CardTitle>
            <CardDescription>
              {mockMode
                ? 'Simulated results (no model attached). '
                : 'Anonymous results. Each snapshot was blurred on the edge node; a detection without one is metadata only. '}
              Push any detection into the live alert pipeline to demo dispatch and ticketing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {events.length === 0 && <p className="text-sm text-muted-foreground">No anomalies above the threshold.</p>}
            {events.map(e => (
              <div key={e.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center">
                <button onClick={() => seek(e.at)} className="shrink-0 rounded" aria-label={`Jump to ${fmt(e.at)}`}>
                  <SnapshotThumb ev={e} className="h-14 w-24" />
                </button>
                <button className="w-12 text-left font-mono text-xs text-link underline underline-offset-2" onClick={() => seek(e.at)}>
                  {fmt(e.at)}
                </button>
                <span className="flex flex-1 flex-wrap items-center gap-2 text-sm">
                  <SeverityBadge severity={e.alert.severity} />
                  <span className="font-medium">{DETECTION_CLASSES[e.alert.detectionClass].label}</span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(e.alert.confidence * 100)}% confidence · {e.alert.boxes.length} box{e.alert.boxes.length > 1 ? 'es' : ''}
                    {e.snapshot && ` · anonymised in ${Math.round(e.snapshot.blurMs ?? 0)} ms`}
                    {e.snapshot === null && ' · no snapshot (metadata only)'}
                  </span>
                </span>
                {e.pushed ? (
                  <StatusBadge tone="success">In alert centre</StatusBadge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => push(e)}>
                    <Send className="mr-2 h-4 w-4" aria-hidden /> Push to alerts
                  </Button>
                )}
              </div>
            ))}
            {!mockMode && (
              <p className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4" aria-hidden /> Evidence snapshots are always anonymised. Pushed
                snapshots follow the retention policy in Settings.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
