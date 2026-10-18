"use client"

import { useRef, useState } from 'react';
import { CheckCircle2, FlaskConical, Loader2, Pause, Play, PlayCircle, Send, ShieldCheck, UploadCloud } from 'lucide-react';
import type { Alert, DetectionClass, ZoneType } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { ZoneScene, displayLabel } from '@/components/anomaly/zone-feed';
import { buildAlert, uid } from '@/lib/anomaly/simulator';
import { analyseClip, detectionToAlert, isLiveBackend } from '@/lib/anomaly/api';
import { DETECTION_CLASSES, DETECTION_CLASS_LIST, SEVERITY_META, ZONE_CLASSES, ZONE_LABELS } from '@/lib/anomaly/taxonomy';

type SandboxEvent = { id: string; at: number; alert: Alert; pushed: boolean };

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function SandboxPage() {
  const { cameras, settings, ingestAlert } = useAnomaly();
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
  const [playing, setPlaying] = useState(false);

  const profileCamera = { ...(cameras.find(c => c.zone === zone) ?? cameras[0]), zone, status: 'online' as const, confidenceThreshold: threshold };
  const active = events?.filter(e => currentTime >= e.at && currentTime < e.at + 4) ?? [];
  const privacy = settings.privacyShield;
  // Without a backend nothing analyses the clip, so face positions are unknown: blur the whole frame instead
  // of pretending to blur faces, and label every detection as simulated.
  const mockMode = !isLiveBackend();
  const blurWholeFrame = !!videoUrl && mockMode && privacy;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.includes('video/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please upload a video clip (mp4, webm, mov).' });
      return;
    }
    setFile(f);
    setPlaying(false);
    setVideoUrl(url => {
      if (url) URL.revokeObjectURL(url);
      return URL.createObjectURL(f);
    });
    setEvents(null);
  };

  const run = async () => {
    setProcessing(true);
    setEvents(null);
    try {
      const camera = cameras.find(c => c.id === targetCamera) ?? profileCamera;
      const live = file ? await analyseClip(file, classes, threshold) : null;
      let result: SandboxEvent[];
      if (live) {
        result = live.map(d => ({
          id: uid('SBX'),
          at: (new Date(d.timestamp).getTime() / 1000) % duration,
          alert: { ...detectionToAlert(d, camera), source: 'sandbox' },
          pushed: false,
        }));
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
      toast({
        title: live ? 'Analysis complete' : 'Simulation complete',
        description: live
          ? `${result.length} anonymised detections across ${classes.length} classes`
          : `${result.length} simulated detections. No model attached, so the clip was not analysed.`,
      });
    } catch (error) {
      console.error('Sandbox analysis failed:', error);
      toast({ variant: 'destructive', title: 'Analysis failed', description: 'The detection service did not respond.' });
    } finally {
      setProcessing(false);
    }
  };

  const push = (ev: SandboxEvent) => {
    ingestAlert({ ...ev.alert, createdAt: new Date().toISOString(), id: uid('ALR') });
    setEvents(es => es?.map(e => (e.id === ev.id ? { ...e, pushed: true } : e)) ?? null);
  };

  const seek = (t: number) => {
    setCurrentTime(t);
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  return (
    <div className="container mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Model Sandbox</h1>
        <p className="text-muted-foreground">
          Test the YOLOv8 anomaly model on pre-recorded footage. Labels stay anonymous.{' '}
          {mockMode
            ? 'No model is attached yet: detections are simulated, and uploaded footage is fully blurred and never leaves this browser.'
            : 'Faces are blurred on the edge model before results come back.'}
        </p>
      </div>

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
                  className={`absolute inset-0 h-full w-full object-fill ${blurWholeFrame ? 'blur-xl scale-105' : ''}`}
                  controls={!blurWholeFrame}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onLoadedMetadata={e => setDuration(e.currentTarget.duration || 30)}
                  onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
                />
              ) : (
                <ZoneScene
                  camera={profileCamera}
                  boxes={active.flatMap(e => e.alert.boxes)}
                  active={new Set(active.map(e => e.alert.detectionClass))}
                  privacy={privacy}
                />
              )}
              {active.flatMap(e =>
                e.alert.boxes.map((b, i) => (
                  <div
                    key={`${e.id}-${i}`}
                    className="pointer-events-none absolute border-2"
                    style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%`, borderColor: DETECTION_CLASSES[e.alert.detectionClass].color }}
                  >
                    <span
                      className="absolute left-[-2px] bottom-full whitespace-nowrap px-1 text-[10px] text-white"
                      style={{ backgroundColor: DETECTION_CLASSES[e.alert.detectionClass].color }}
                    >
                      {displayLabel(b, privacy)}
                    </span>
                  </div>
                ))
              )}
              {/* Blur patches on real footage: backdrop blur over each reported face region. */}
              {videoUrl &&
                privacy &&
                !mockMode &&
                active.flatMap(e =>
                  e.alert.boxes
                    .filter(b => b.faceRegion)
                    .map((b, i) => (
                      <div
                        key={`blur-${e.id}-${i}`}
                        className="pointer-events-none absolute rounded-full backdrop-blur-md bg-white/10 ring-1 ring-emerald-400"
                        style={{
                          left: `${b.faceRegion!.x - b.faceRegion!.r * 1.6}%`,
                          top: `${b.faceRegion!.y - b.faceRegion!.r * 2}%`,
                          width: `${b.faceRegion!.r * 3.2}%`,
                          height: `${b.faceRegion!.r * 4}%`,
                        }}
                      />
                    ))
                )}
              {privacy && (
                <span className="absolute top-2 right-2 flex items-center gap-1 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] text-white">
                  <ShieldCheck className="h-3 w-3" /> {blurWholeFrame ? 'Whole frame blurred' : videoUrl ? 'Faces blurred by model' : 'Faces anonymised'}
                </span>
              )}
              {blurWholeFrame && (
                // The native controls would be blurred along with the frame, so offer play/pause outside the filter.
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute bottom-2 left-2 h-8"
                  aria-label={playing ? 'Pause clip' : 'Play clip'}
                  onClick={() => (playing ? videoRef.current?.pause() : videoRef.current?.play())}
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
              )}
              {videoUrl && mockMode && (
                <span className="absolute top-2 left-2 flex items-center gap-1 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-black">
                  <FlaskConical className="h-3 w-3" /> Simulated detections · clip not analysed
                </span>
              )}
            </div>

            {events && (
              <div className="space-y-1">
                <div className="relative h-6 rounded bg-muted">
                  {events.map(e => (
                    <button
                      key={e.id}
                      title={`${DETECTION_CLASSES[e.alert.detectionClass].label} @ ${fmt(e.at)}`}
                      onClick={() => seek(e.at)}
                      className="absolute top-1 h-4 w-2 rounded-sm"
                      style={{ left: `${(e.at / duration) * 100}%`, backgroundColor: DETECTION_CLASSES[e.alert.detectionClass].color }}
                    />
                  ))}
                  <div className="absolute top-0 h-6 w-0.5 bg-foreground" style={{ left: `${(currentTime / duration) * 100}%` }} />
                </div>
                {!videoUrl && (
                  <Slider min={0} max={duration} step={0.5} value={[currentTime]} onValueChange={([v]) => setCurrentTime(v)} />
                )}
                <p className="text-xs text-muted-foreground">
                  {fmt(currentTime)} / {fmt(duration)}: click a marker to jump to a detection
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Input type="file" accept="video/*" onChange={handleFile} className="max-w-xs" />
              {videoUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setPlaying(false);
                    setVideoUrl(url => {
                      if (url) URL.revokeObjectURL(url);
                      return null;
                    });
                    setEvents(null);
                    setDuration(30);
                  }}
                >
                  Use sample scene instead
                </Button>
              )}
              {!videoUrl && <UploadCloud className="h-4 w-4 text-muted-foreground" />}
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
              <Label>Zone profile</Label>
              <Select
                value={zone}
                onValueChange={v => {
                  setZone(v as ZoneType);
                  setClasses(ZONE_CLASSES[v as ZoneType]);
                }}
              >
                <SelectTrigger>
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
              <Label>Detection classes</Label>
              {DETECTION_CLASS_LIST.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={classes.includes(c.id)}
                    onCheckedChange={v => setClasses(cs => (v ? [...cs, c.id] : cs.filter(x => x !== c.id)))}
                  />
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
                  {c.label}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Confidence threshold</Label>
                <span className="font-mono text-sm">{threshold.toFixed(2)}</span>
              </div>
              <Slider min={0.3} max={0.95} step={0.05} value={[threshold]} onValueChange={([v]) => setThreshold(Number(v.toFixed(2)))} />
            </div>
            <div className="space-y-2">
              <Label>Attribute pushed alerts to</Label>
              <Select value={targetCamera} onValueChange={setTargetCamera}>
                <SelectTrigger>
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running inference…
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-4 w-4" /> Run analysis
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
              {mockMode ? 'Simulated results (no model attached). ' : 'Anonymous results. '}
              Push any detection into the live alert pipeline to demo dispatch and ticketing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {events.length === 0 && <p className="text-sm text-muted-foreground">No anomalies above the threshold.</p>}
            {events.map(e => (
              <div key={e.id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border p-3">
                <button className="font-mono text-xs text-muted-foreground w-12 text-left underline" onClick={() => seek(e.at)}>
                  {fmt(e.at)}
                </button>
                <span className="flex items-center gap-2 flex-1 text-sm">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: DETECTION_CLASSES[e.alert.detectionClass].color }} />
                  <span className="font-medium">{DETECTION_CLASSES[e.alert.detectionClass].label}</span>
                  <Badge variant="outline" className={SEVERITY_META[e.alert.severity].badge}>
                    {SEVERITY_META[e.alert.severity].label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    conf {e.alert.confidence.toFixed(2)} · {e.alert.boxes.length} box{e.alert.boxes.length > 1 ? 'es' : ''}
                  </span>
                </span>
                {e.pushed ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> In alert centre
                  </span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => push(e)}>
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Push to alerts
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
