"use client"

import { useEffect, useState } from 'react';
import { Building2, Clock, FlaskConical, ScanEye, ShieldCheck } from 'lucide-react';
import type { Severity } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import RetentionSettings from '@/components/settings/retention-settings';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { AuditEntryText, PrivacyShieldSwitch } from '@/components/anomaly/privacy-shield';
import { ResetDemoButton } from '@/components/anomaly/reset-demo-button';
import { DETECTION_CLASS_LIST, SEVERITY_META } from '@/lib/anomaly/taxonomy';
import { API_BASE, isLiveBackend } from '@/lib/anomaly/api';

const TABS = ['general', 'detection', 'privacy', 'simulation', 'retention'] as const;

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<string>('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab && (TABS as readonly string[]).includes(tab)) setActiveTab(tab);
  }, []);

  const onSubmit = (_data: unknown, formName: string) => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      toast({ title: 'Settings saved', description: `Your ${formName} settings have been updated.` });
    }, 600);
  };

  return (
    <div className="container mx-auto space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Township profile, detection policy, privacy controls and demo simulation.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 py-2">
          <TabsList className="grid grid-cols-5 h-auto">
            <TabsTrigger value="general" className="flex gap-2 items-center">
              <Building2 className="h-4 w-4" />
              <span className="hidden md:block">Township</span>
            </TabsTrigger>
            <TabsTrigger value="detection" className="flex gap-2 items-center">
              <ScanEye className="h-4 w-4" />
              <span className="hidden md:block">Detection</span>
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex gap-2 items-center">
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden md:block">Privacy &amp; PDPA</span>
            </TabsTrigger>
            <TabsTrigger value="simulation" className="flex gap-2 items-center">
              <FlaskConical className="h-4 w-4" />
              <span className="hidden md:block">Simulation</span>
            </TabsTrigger>
            <TabsTrigger value="retention" className="flex gap-2 items-center">
              <Clock className="h-4 w-4" />
              <span className="hidden md:block">Retention</span>
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
          <RetentionSettings onSubmit={onSubmit} isSubmitting={isSubmitting} />
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
                <Label className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
                  {c.label} <code className="text-[10px] text-muted-foreground">{c.id}</code>
                </Label>
                <span className="font-mono text-sm">{settings.classThresholds[c.id].toFixed(2)}</span>
              </div>
              <Slider
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

function PrivacySettings() {
  const { audit } = useAnomaly();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>PDPA Privacy Shield</CardTitle>
          <CardDescription>Privacy by design under Malaysia&apos;s Personal Data Protection Act 2010.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium text-sm">Anonymise faces on live feeds</p>
              <p className="text-xs text-muted-foreground">
                Turning this off needs confirmation and is recorded in the audit trail. Stored frames stay anonymised.
              </p>
            </div>
            <PrivacyShieldSwitch />
          </div>
          <ul className="space-y-2 text-sm">
            {[
              'No facial recognition, enrolment photos or face templates',
              'No person re-identification or cross-camera tracking',
              'Labels describe states: "Pedestrian (Face Blurred)", "Vehicle on Ramp (Plate Masked)"',
              'Faces are blurred on the edge node before any frame is stored; stored snapshots can never be un-blurred',
              'Turning the shield off only un-blurs the live view for emergency verification, and is never recorded',
              'Exports contain detection metadata only, never imagery of people',
            ].map(t => (
              <li key={t} className="flex gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                {t}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Privacy audit trail</CardTitle>
          <CardDescription>Every change to anonymisation, and every demo reset, is logged with the operator&apos;s name.</CardDescription>
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
