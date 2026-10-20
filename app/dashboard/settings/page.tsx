"use client"

import { useEffect, useState } from 'react';
import { Building2, CircleDashed, Clock, FlaskConical, Scale, ScanEye, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { Severity } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { AuditEntryText, PRIVACY_STATUS } from '@/components/anomaly/privacy-shield';
import { ResetDemoButton } from '@/components/anomaly/reset-demo-button';
import { DETECTION_CLASS_LIST, SEVERITY_META } from '@/lib/anomaly/taxonomy';
import { API_BASE, isLiveBackend } from '@/lib/anomaly/api';
import { storedSnapshotIds } from '@/lib/anomaly/snapshot-store';

const TABS = ['general', 'detection', 'privacy', 'simulation', 'retention'] as const;
const RETENTION_DAYS = [7, 14, 30, 60, 90];
const RESOLVED_RETENTION_DAYS = [1, 3, 7, 14, 30];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<string>('general');

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab && (TABS as readonly string[]).includes(tab)) setActiveTab(tab);
  }, []);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-8">
      <PageHeader
        title="Settings"
        description="Township profile, detection policy, privacy and retention, and demo simulation."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="sticky top-0 z-10 bg-background py-2">
          <TabsList className="grid h-auto w-full grid-cols-5" aria-label="Settings sections">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="sr-only md:not-sr-only md:whitespace-nowrap">Township</span>
            </TabsTrigger>
            <TabsTrigger value="detection" className="flex items-center gap-2">
              <ScanEye className="h-4 w-4" />
              <span className="sr-only md:not-sr-only md:whitespace-nowrap">Detection</span>
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span className="sr-only md:not-sr-only md:whitespace-nowrap">Privacy &amp; Compliance</span>
            </TabsTrigger>
            <TabsTrigger value="simulation" className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              <span className="sr-only md:not-sr-only md:whitespace-nowrap">Simulation</span>
            </TabsTrigger>
            <TabsTrigger value="retention" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="sr-only md:not-sr-only md:whitespace-nowrap">Retention</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general">
          <TownshipSettings />
        </TabsContent>
        <TabsContent value="detection">
          <DetectionSettings />
        </TabsContent>
        <TabsContent value="privacy">
          <PrivacySettings />
        </TabsContent>
        <TabsContent value="simulation">
          <SimulationSettings />
        </TabsContent>
        <TabsContent value="retention">
          <RetentionSettings onOpenPrivacy={() => setActiveTab('privacy')} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TownshipSettings() {
  const { settings, updateSettings } = useAnomaly();
  const { toast } = useToast();
  const [draft, setDraft] = useState({ systemName: settings.systemName, township: settings.township, timezone: settings.timezone });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Township profile</CardTitle>
        <CardDescription>Shown in the header and on every exported audit report.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 max-w-xl">
        <div className="space-y-2">
          <Label htmlFor="systemName">Platform name</Label>
          <Input id="systemName" value={draft.systemName} onChange={e => setDraft(d => ({ ...d, systemName: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="township">Township</Label>
          <Input id="township" value={draft.township} onChange={e => setDraft(d => ({ ...d, township: e.target.value }))} />
          <p className="text-xs text-muted-foreground">e.g. SDP Township · City of Elmina, or SDP Township · Bandar Ainsdale</p>
        </div>
        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select value={draft.timezone} onValueChange={v => setDraft(d => ({ ...d, timezone: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Asia/Kuala_Lumpur">Asia/Kuala_Lumpur (MYT, UTC+8)</SelectItem>
              <SelectItem value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</SelectItem>
              <SelectItem value="UTC">UTC</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          disabled={draft.systemName.trim().length < 2}
          onClick={() => {
            updateSettings(draft);
            toast({ title: 'Township profile saved' });
          }}
        >
          Save changes
        </Button>
      </CardContent>
    </Card>
  );
}

function DetectionSettings() {
  const { settings, updateSettings } = useAnomaly();
  const toggleSeverity = (s: Severity, on: boolean) =>
    updateSettings({ toastSeverities: on ? [...settings.toastSeverities, s] : settings.toastSeverities.filter(x => x !== s) });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Class confidence thresholds</CardTitle>
          <CardDescription>
            Township-wide minimum confidence per anomaly class. The stricter of this and the camera&apos;s own threshold applies.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {DETECTION_CLASS_LIST.map(c => (
            <div key={c.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label id={`thr-${c.id}`}>{c.label}</Label>
                <span className="text-sm tabular">{Math.round(settings.classThresholds[c.id] * 100)}%</span>
              </div>
              <Slider
                aria-labelledby={`thr-${c.id}`}
                min={0.3}
                max={0.95}
                step={0.05}
                value={[settings.classThresholds[c.id]]}
                onValueChange={([v]) => updateSettings({ classThresholds: { ...settings.classThresholds, [c.id]: Number(v.toFixed(2)) } })}
              />
              <p className="text-xs text-muted-foreground">{c.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alert triggers</CardTitle>
          <CardDescription>When operators are notified, and when anonymous crowd counts become an alert.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 max-w-xl">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Crowd density warning at</Label>
              <span className="font-mono text-sm">{settings.crowdWarningThreshold} people</span>
            </div>
            <Slider
              min={4}
              max={14}
              step={1}
              value={[settings.crowdWarningThreshold]}
              onValueChange={([v]) => updateSettings({ crowdWarningThreshold: v })}
            />
            <p className="text-xs text-muted-foreground">Head-count only. Individuals are never tracked across frames or cameras.</p>
          </div>
          <div className="space-y-2">
            <Label>Pop-up notifications for</Label>
            <div className="flex gap-4">
              {(['critical', 'warning', 'info'] as Severity[]).map(s => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={settings.toastSeverities.includes(s)} onCheckedChange={v => toggleSeverity(s, !!v)} />
                  {SEVERITY_META[s].label}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map(t => (
        <li key={t} className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          {t}
        </li>
      ))}
    </ul>
  );
}

function PrivacySettings() {
  const { audit, settings } = useAnomaly();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Privacy &amp; Compliance</CardTitle>
          <CardDescription>Privacy-by-design, aligned with the principles of Malaysia&apos;s PDPA 2010.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-2 rounded-md border bg-muted p-3 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
            {PRIVACY_STATUS}
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">What is stored</h3>
            <Checklist
              items={[
                'Detection metadata: class, camera, time, confidence and anonymous bounding boxes',
                'One evidence snapshot per newly opened alert, with faces blurred on the edge node before the image leaves it. If blurring fails, no image is kept.',
                'An optional after-fix photo per resolved ticket, blurred the same way and kept under the same retention policy',
                'The audit trail of operator actions, snapshot views and exports, and report exports',
              ]}
            />
            <p className="text-xs text-muted-foreground">
              Not stored: live video, recordings, uploaded sandbox clips, face templates or identities. No facial
              recognition, re-identification or cross-camera tracking.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Retention</h3>
            <p className="text-sm">
              Snapshots are deleted automatically after {settings.snapshotRetentionDays} days, or{' '}
              {settings.resolvedSnapshotRetentionDays} days after the alert is resolved, whichever is sooner. Each deletion
              run is logged. Change this under Retention.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Who can view</h3>
            <Checklist
              items={[
                'Authorised operators only, after signing in',
                'Live view is transient and for authorised operators only; it is not recorded',
                'Every snapshot view and export is logged with the operator’s name',
              ]}
            />
          </section>

          <section className="rounded-md border border-warning/40 bg-warning-soft p-3 text-sm text-warning-fg">
            <p className="flex items-center gap-2 font-semibold">
              <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
              Signage reminder
            </p>
            <p className="mt-1 text-xs">
              Put up a clear notice at every monitored zone saying that cameras are in use, why, who operates them and
              how to contact the township management office.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Roadmap</h3>
            <ul className="space-y-1.5 text-sm">
              {[
                'Appoint a data protection officer',
                'Complete a data protection impact assessment',
                'Define a breach reporting procedure',
                'Handle access and correction requests',
                'Move the audit trail to an append-only server log',
              ].map(t => (
                <li key={t} className="flex gap-2">
                  <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </section>

          <p className="flex gap-2 border-t pt-3 text-xs text-muted-foreground">
            <Scale className="h-4 w-4 shrink-0" />
            This page describes how Orbit is designed. It is not legal advice; confirm your obligations under
            the PDPA with a qualified adviser.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Privacy audit trail</CardTitle>
          <CardDescription>
            Snapshot views and exports, retention changes and deletions, and demo resets, with the operator&apos;s name.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[360px] overflow-y-auto">
          {audit.map(e => (
            <div key={e.id} className="rounded-md border p-2 text-xs">
              <p className="text-muted-foreground">{new Date(e.at).toLocaleString('en-MY', { hour12: false })}</p>
              <p>
                <AuditEntryText entry={e} />
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function RetentionSettings({ onOpenPrivacy }: { onOpenPrivacy: () => void }) {
  const { settings, alerts, updateSettings, purgeExpiredSnapshots } = useAnomaly();
  const { toast } = useToast();
  const [stored, setStored] = useState<number | null>(null);
  const [purging, setPurging] = useState(false);
  const snapshotAlerts = alerts.filter(a => a.snapshot?.status === 'ready').length;

  useEffect(() => {
    storedSnapshotIds()
      .then(ids => setStored(ids.length))
      .catch(() => setStored(null));
  }, [alerts]);

  const daySelect = (value: number, options: number[], onChange: (v: number) => void) => (
    <Select value={String(value)} onValueChange={v => onChange(Number(v))}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(d => (
          <SelectItem key={d} value={String(d)}>
            {d} day{d > 1 ? 's' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence snapshot retention</CardTitle>
        <CardDescription>
          Only alert metadata and anonymised snapshots are stored; there is no footage to retain. Snapshots are
          deleted automatically, whichever limit comes first. Changes are logged.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 max-w-xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Delete after capture</Label>
            {daySelect(settings.snapshotRetentionDays, RETENTION_DAYS, v => updateSettings({ snapshotRetentionDays: v }))}
            <p className="text-xs text-muted-foreground">Default 30 days</p>
          </div>
          <div className="space-y-2">
            <Label>Delete after the alert is resolved</Label>
            {daySelect(settings.resolvedSnapshotRetentionDays, RESOLVED_RETENTION_DAYS, v =>
              updateSettings({ resolvedSnapshotRetentionDays: v })
            )}
            <p className="text-xs text-muted-foreground">Default 7 days</p>
          </div>
        </div>
        <div className="rounded-md border p-3 text-sm space-y-1">
          <p className="font-medium">Stored in this browser</p>
          <p className="text-xs text-muted-foreground">
            {stored === null ? 'Snapshot store unavailable.' : `${stored} snapshot${stored === 1 ? '' : 's'} stored`} ·{' '}
            {snapshotAlerts} alert{snapshotAlerts === 1 ? '' : 's'} with a viewable snapshot. Expired snapshots are
            checked every minute.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={purging}
            onClick={async () => {
              setPurging(true);
              const n = await purgeExpiredSnapshots();
              setPurging(false);
              toast({ title: n ? `Deleted ${n} expired snapshot${n > 1 ? 's' : ''}` : 'No snapshots past retention' });
            }}
          >
            Delete expired now
          </Button>
          <Button variant="ghost" onClick={onOpenPrivacy}>
            What is stored?
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SimulationSettings() {
  const { settings, updateSettings } = useAnomaly();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Simulation &amp; backend</CardTitle>
        <CardDescription>Simulated incidents let the demo run end to end without a live YOLOv8 pipeline.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 max-w-xl">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="font-medium text-sm">Auto-generate incidents</p>
            <p className="text-xs text-muted-foreground">Random class and zone, respecting each camera&apos;s enabled classes.</p>
          </div>
          <Switch checked={settings.autoSimulate} onCheckedChange={v => updateSettings({ autoSimulate: v })} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Interval</Label>
            <span className="font-mono text-sm">{settings.simulateEverySec}s</span>
          </div>
          <Slider min={5} max={120} step={5} value={[settings.simulateEverySec]} onValueChange={([v]) => updateSettings({ simulateEverySec: v })} />
        </div>
        <div className="rounded-md border p-3 text-sm space-y-1">
          <p className="font-medium">Detection backend</p>
          <p className="text-muted-foreground text-xs">
            {isLiveBackend()
              ? `Polling FastAPI at ${API_BASE}/api/v1/detections`
              : 'Simulation mode. Set NEXT_PUBLIC_ANOMALYGUARD_API to connect the FastAPI + YOLOv8 service.'}
          </p>
        </div>
        <ResetDemoButton />
      </CardContent>
    </Card>
  );
}
