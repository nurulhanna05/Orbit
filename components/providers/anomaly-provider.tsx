"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AfterPhoto, Alert, AppSettings, Camera, DetectionClass, Ticket, TicketStatus, WearEvent } from '@/lib/types';
import { AnomalyState, SEED_CAMERAS, STATE_VERSION, buildSeedState, defaultContractorFor, nameOf } from '@/lib/anomaly/seed';
import { buildAlert, randomIncident, uid } from '@/lib/anomaly/simulator';
import { DETECTION_CLASSES, SEVERITY_META } from '@/lib/anomaly/taxonomy';
import { SnapshotInput, detectionToAlert, fetchDetectionsSince, isLiveBackend, snapshotInput } from '@/lib/anomaly/api';
import {
  afterPhotoExpiry,
  afterPhotoKey,
  deleteSnapshot,
  putSnapshot,
  snapshotExpiry,
  storedSnapshotIds,
  ticketIdOfKey,
} from '@/lib/anomaly/snapshot-store';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/components/providers/auth-provider';

const STORAGE_KEY = 'anomalyguard-state';
const MAX_ALERTS = 400;
const PURGE_EVERY_MS = 60000;
const PROCESSING_TIMEOUT_MS = 5 * 60000; // a snapshot still 'processing' this long after capture was lost (e.g. a reload)
// Each zone's usual anonymous head-count; the live crowd count wanders around it instead of creeping upward.
const CROWD_BASELINE = Object.fromEntries(SEED_CAMERAS.map(c => [c.id, c.crowdCount]));

type AnomalyContextType = AnomalyState & {
  tick: number;
  simulateIncident: (cls?: DetectionClass, cameraId?: string) => Alert | null;
  /** `snapshot` may still be in flight: the alert shows at once and the snapshot is attached when it arrives. */
  ingestAlert: (alert: Alert, snapshot?: Promise<SnapshotInput | null> | SnapshotInput | null) => void;
  markAlertRead: (id: string) => void;
  markAllAlertsRead: () => void;
  dispatchAlert: (id: string, contractorId: string) => void;
  resolveAlert: (id: string) => void;
  reopenAlert: (id: string) => void;
  createTicketFromAlert: (alertId: string, contractorId?: string) => Ticket | null;
  setTicketStatus: (id: string, status: TicketStatus) => void;
  resolveTicket: (id: string, resolution: { notes: string; photo: SnapshotInput | 'simulated' | null }) => Promise<void>;
  reassignTicket: (id: string, contractorId: string) => void;
  toggleCamera: (id: string) => void;
  updateCamera: (id: string, patch: Partial<Camera>) => void;
  logSnapshotAccess: (alertId: string, action: 'viewed' | 'exported') => void;
  logAfterPhotoAccess: (ticketId: string, action: 'viewed' | 'exported') => void;
  logReportExport: (reportId: string, subject: string) => void;
  purgeExpiredSnapshots: () => Promise<number>;
  updateSettings: (patch: Partial<AppSettings>) => void;
  resetDemo: () => void;
};

const AnomalyContext = createContext<AnomalyContextType | undefined>(undefined);

const now = () => new Date().toISOString();

function loadState(): AnomalyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AnomalyState;
      if (parsed.version === STATE_VERSION) return renameProduct(parsed);
      if (parsed.version === 1) return renameProduct(migrateV1(parsed));
    }
  } catch (error) {
    console.error('Error loading Orbit state:', error);
  }
  return buildSeedState();
}

// The product was renamed from AnomalyGuard to Orbit. A name the operator chose themselves is kept.
function renameProduct(state: AnomalyState): AnomalyState {
  if (state.settings.systemName !== 'AnomalyGuard') return state;
  return { ...state, settings: { ...state.settings, systemName: 'Orbit' } };
}

// v1 had a Privacy Shield toggle; v2 always anonymises evidence snapshots and adds retention settings.
// Everything else, including the audit trail, carries over.
function migrateV1(v1: AnomalyState): AnomalyState {
  const { privacyShield: _dropped, ...settings } = v1.settings as AppSettings & { privacyShield?: boolean };
  const seed = buildSeedState();
  return {
    ...v1,
    version: STATE_VERSION,
    settings: {
      ...settings,
      snapshotRetentionDays: seed.settings.snapshotRetentionDays,
      resolvedSnapshotRetentionDays: seed.settings.resolvedSnapshotRetentionDays,
    },
    audit: [
      {
        id: uid('AUD'),
        at: now(),
        actor: 'System',
        text: 'Privacy Shield toggle retired: evidence snapshots are always anonymised; live view is transient and for authorised operators only.',
      },
      ...v1.audit,
    ],
  };
}

// Applies the predictive-maintenance wear model for a freshly flagged alert.
function applyWear(state: AnomalyState, alert: Alert): { state: AnomalyState; alert: Alert } {
  const meta = DETECTION_CLASSES[alert.detectionClass];
  if (!meta.assetType || !meta.healthImpactPct) return { state, alert };
  const target =
    state.assets.find(a => a.type === meta.assetType && a.cameraId === alert.cameraId) ??
    state.assets.find(a => a.type === meta.assetType);
  if (!target) return { state, alert };
  const event: WearEvent = {
    id: uid('WR'),
    assetId: target.id,
    at: alert.createdAt,
    cause: alert.detectionClass,
    healthDeltaPct: -meta.healthImpactPct,
    lifeDeltaMonths: -(meta.lifeImpactMonths ?? 0),
    note: `${meta.label} flagged by ${alert.cameraId} (conf ${alert.confidence.toFixed(2)})`,
    alertId: alert.id,
  };
  return {
    alert: { ...alert, assetId: target.id },
    state: {
      ...state,
      wear: [event, ...state.wear],
      assets: state.assets.map(a =>
        a.id === target.id
          ? {
              ...a,
              healthPct: Math.max(0, a.healthPct + event.healthDeltaPct),
              remainingLifeMonths: Math.max(0, a.remainingLifeMonths + event.lifeDeltaMonths),
            }
          : a
      ),
    },
  };
}

// A completed repair restores part (not all) of the health lost to the incident.
function applyRepair(state: AnomalyState, alert: Alert): AnomalyState {
  if (!alert.assetId) return state;
  const lost = state.wear.find(w => w.alertId === alert.id && w.cause !== 'repair');
  if (!lost || state.wear.some(w => w.alertId === alert.id && w.cause === 'repair')) return state;
  const restored = Math.round(Math.abs(lost.healthDeltaPct) * 0.6);
  const event: WearEvent = {
    id: uid('WR'),
    assetId: alert.assetId,
    at: now(),
    cause: 'repair',
    healthDeltaPct: restored,
    lifeDeltaMonths: Math.round(Math.abs(lost.lifeDeltaMonths) * 0.5),
    note: `Repair closed out ${alert.id}; residual wear retained`,
    alertId: alert.id,
  };
  return {
    ...state,
    wear: [event, ...state.wear],
    assets: state.assets.map(a =>
      a.id === alert.assetId
        ? {
            ...a,
            healthPct: Math.min(100, a.healthPct + event.healthDeltaPct),
            remainingLifeMonths: a.remainingLifeMonths + event.lifeDeltaMonths,
          }
        : a
    ),
  };
}

const withHistory = (alert: Alert, action: string): Alert => ({
  ...alert,
  history: [...alert.history, { at: now(), action }],
});

const withLog = (ticket: Ticket, action: string): Ticket => ({ ...ticket, log: [...ticket.log, { at: now(), action }] });

// An open alert of the same class on the same camera is the same incident, re-detected.
const findOpenDuplicate = (alerts: Alert[], incoming: Alert) =>
  alerts.find(
    a => a.cameraId === incoming.cameraId && a.detectionClass === incoming.detectionClass && a.status !== 'resolved'
  );

export function AnomalyProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AnomalyState | null>(null);
  const [tick, setTick] = useState(0);
  const stateRef = useRef<AnomalyState | null>(null);
  stateRef.current = state;

  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving Orbit state:', error);
    }
  }, [state]);

  const update = useCallback((fn: (s: AnomalyState) => AnomalyState) => {
    setState(s => (s ? fn(s) : s));
  }, []);

  const setSnapshot = useCallback((alertId: string, patch: Partial<NonNullable<Alert['snapshot']>>) => {
    setState(s =>
      s
        ? {
            ...s,
            alerts: s.alerts.map(a => (a.id === alertId && a.snapshot ? { ...a, snapshot: { ...a.snapshot, ...patch } } : a)),
          }
        : s
    );
  }, []);

  // Stores the anonymised JPEG once it arrives. Fails closed: if it never comes, or cannot be stored,
  // the alert keeps its metadata and says the snapshot is unavailable.
  const attachSnapshot = useCallback(
    async (alertId: string, source: Promise<SnapshotInput | null> | SnapshotInput | null) => {
      try {
        const snap = await source;
        if (snap) {
          await putSnapshot(alertId, snap.jpeg);
          setSnapshot(alertId, { status: 'ready', blurMs: snap.blurMs, crop: snap.crop });
          return;
        }
      } catch (error) {
        console.error('Evidence snapshot not stored:', error);
      }
      setSnapshot(alertId, { status: 'unavailable' });
    },
    [setSnapshot]
  );

  const ingestAlert = useCallback((incoming: Alert, snapshot?: Promise<SnapshotInput | null> | SnapshotInput | null) => {
    const current = stateRef.current;
    if (!current) return;
    const camera = current.cameras.find(c => c.id === incoming.cameraId);
    const threshold = Math.max(
      camera?.confidenceThreshold ?? 0,
      current.settings.classThresholds[incoming.detectionClass] ?? 0
    );
    // Only live edge detections are gated; simulated and sandbox alerts are explicit operator actions.
    if (incoming.source === 'edge' && incoming.confidence < threshold) return;

    const duplicate = !!findOpenDuplicate(current.alerts, incoming);
    // Only a newly opened alert keeps an evidence snapshot; a re-detection never stores another frame.
    const withSnapshot = !duplicate && snapshot !== undefined;
    setState(s => {
      if (!s) return s;
      const open = findOpenDuplicate(s.alerts, incoming);
      if (open) {
        // Fold the repeat into the existing alert: no second alert, no second wear charge.
        const merged = withHistory(
          { ...open, confidence: Math.max(open.confidence, incoming.confidence) },
          `Re-detected (conf ${incoming.confidence.toFixed(2)})`
        );
        return { ...s, alerts: s.alerts.map(a => (a.id === open.id ? merged : a)) };
      }
      const fresh: Alert = withSnapshot ? { ...incoming, snapshot: { status: 'processing', capturedAt: incoming.createdAt } } : incoming;
      const { state: worn, alert } = applyWear(s, fresh);
      return { ...worn, alerts: [alert, ...worn.alerts].slice(0, MAX_ALERTS) };
    });
    if (withSnapshot) attachSnapshot(incoming.id, snapshot);

    if (duplicate) {
      toast({
        title: `Already open: ${DETECTION_CLASSES[incoming.detectionClass].label}`,
        description: `${incoming.cameraName} · added to the existing alert`,
      });
    } else if (current.settings.toastSeverities.includes(incoming.severity)) {
      toast({
        variant: incoming.severity === 'critical' ? 'destructive' : 'default',
        title: `${SEVERITY_META[incoming.severity].label}: ${DETECTION_CLASSES[incoming.detectionClass].label}`,
        description: `${incoming.cameraName} · conf ${incoming.confidence.toFixed(2)}`,
      });
    }
  }, [attachSnapshot]);

  // Retention: deletes stored snapshots past their expiry, and any whose alert no longer exists.
  const purgeExpiredSnapshots = useCallback(async () => {
    const current = stateRef.current;
    if (!current) return 0;
    let stored: string[];
    try {
      stored = await storedSnapshotIds();
    } catch (error) {
      console.error('Snapshot store unavailable:', error);
      return 0;
    }
    const byId = new Map(current.alerts.map(a => [a.id, a]));
    const ticketsById = new Map(current.tickets.map(tk => [tk.id, tk]));
    const t = Date.now();
    const expired = stored.filter(id => {
      const ticketId = ticketIdOfKey(id);
      if (ticketId) {
        // An after-fix photo whose ticket is gone, or no longer points at a stored photo, is an orphan.
        const ticket = ticketsById.get(ticketId);
        const expiry = ticket?.afterPhoto?.status === 'ready' ? afterPhotoExpiry(ticket, current.settings) : null;
        return !expiry || expiry.getTime() <= t;
      }
      const alert = byId.get(id);
      const expiry = alert && snapshotExpiry(alert, current.settings);
      return !alert || (!!expiry && expiry.getTime() <= t);
    });
    const deleted = new Set<string>();
    for (const id of expired) {
      try {
        await deleteSnapshot(id);
        deleted.add(id);
      } catch (error) {
        console.error(`Could not delete snapshot ${id}:`, error);
      }
    }
    const storedSet = new Set(stored);
    const lost = new Set(
      current.alerts
        .filter(
          a =>
            a.snapshot?.status === 'processing' &&
            !storedSet.has(a.id) &&
            t - new Date(a.snapshot.capturedAt).getTime() > PROCESSING_TIMEOUT_MS
        )
        .map(a => a.id)
    );
    if (deleted.size === 0 && lost.size === 0) return 0;
    setState(s => {
      if (!s) return s;
      const alerts = s.alerts.map(a => {
        if (!a.snapshot) return a;
        if (deleted.has(a.id)) return { ...a, snapshot: { ...a.snapshot, status: 'deleted' as const, deletedAt: now() } };
        if (lost.has(a.id) && a.snapshot.status === 'processing') return { ...a, snapshot: { ...a.snapshot, status: 'unavailable' as const } };
        return a;
      });
      const tickets = s.tickets.map(tk =>
        deleted.has(afterPhotoKey(tk.id)) && tk.afterPhoto?.source === 'edge'
          ? { ...tk, afterPhoto: { ...tk.afterPhoto, status: 'deleted' as const, deletedAt: now() } }
          : tk
      );
      const ids = Array.from(deleted).map(id => {
        const ticketId = ticketIdOfKey(id);
        return ticketId ? `after-fix photo of ${ticketId}` : id;
      });
      const entry = ids.length
        ? [
            {
              id: uid('AUD'),
              at: now(),
              actor: 'System',
              text: `Retention policy: deleted ${ids.length} evidence snapshot${ids.length > 1 ? 's' : ''} (${ids.slice(0, 5).join(', ')}${ids.length > 5 ? ', …' : ''}).`,
            },
          ]
        : [];
      return { ...s, alerts, tickets, audit: [...entry, ...s.audit] };
    });
    return deleted.size;
  }, []);

  const retention = state ? `${state.settings.snapshotRetentionDays}/${state.settings.resolvedSnapshotRetentionDays}` : '';
  useEffect(() => {
    if (!retention) return;
    purgeExpiredSnapshots();
    const id = setInterval(purgeExpiredSnapshots, PURGE_EVERY_MS);
    return () => clearInterval(id);
  }, [retention, purgeExpiredSnapshots]);

  const simulateIncident = useCallback(
    (cls?: DetectionClass, cameraId?: string) => {
      const current = stateRef.current;
      if (!current) return null;
      const pool = cameraId ? current.cameras.filter(c => c.id === cameraId) : current.cameras;
      const pickResult = randomIncident(pool, Math.random, cls);
      if (!pickResult) {
        toast({
          title: 'No eligible camera',
          description: 'Bring a camera online or enable this detection class on it first.',
        });
        return null;
      }
      const alert = buildAlert(pickResult.camera, pickResult.cls);
      // Simulated incidents always clear the confidence gate so the demo is predictable.
      alert.confidence = Math.max(
        alert.confidence,
        pickResult.camera.confidenceThreshold,
        current.settings.classThresholds[alert.detectionClass]
      );
      ingestAlert(alert);
      return alert;
    },
    [ingestAlert]
  );

  // Live clock: drifts anonymous crowd counts, raises crowd-density alerts and runs auto-simulation.
  useEffect(() => {
    if (!state) return;
    const id = setInterval(() => {
      setTick(t => t + 1);
      const current = stateRef.current;
      if (!current) return;
      const cameras = current.cameras.map(c => {
        if (c.status === 'offline') return c;
        // Mean-reverting walk around the zone's baseline, with an occasional short-lived surge.
        const baseline = CROWD_BASELINE[c.id] ?? 2;
        const surge = Math.random() < 0.02 ? 4 : 0;
        const drift = Math.round((baseline - c.crowdCount) * 0.25 + (Math.random() - 0.5) * 2.4) + surge;
        return { ...c, crowdCount: Math.max(0, Math.min(14, c.crowdCount + drift)), lastSeen: now() };
      });
      const drifted = new Map(cameras.map(c => [c.id, c]));
      // Merge only the drifted fields so a camera edit made since the snapshot is not overwritten.
      setState(s =>
        s
          ? {
              ...s,
              cameras: s.cameras.map(c => {
                const d = drifted.get(c.id);
                return d && c.status === 'online' ? { ...c, crowdCount: d.crowdCount, lastSeen: d.lastSeen } : c;
              }),
            }
          : s
      );
      for (const c of cameras) {
        const crowded = c.crowdCount >= current.settings.crowdWarningThreshold;
        const alreadyOpen = current.alerts.some(
          a => a.cameraId === c.id && a.detectionClass === 'crowd_density' && a.status !== 'resolved'
        );
        if (crowded && !alreadyOpen && c.enabledClasses.includes('crowd_density')) {
          ingestAlert(buildAlert(c, 'crowd_density', { severity: 'warning' }));
        }
      }
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state === null, ingestAlert]);

  const autoSimulate = state?.settings.autoSimulate;
  const simulateEverySec = state?.settings.simulateEverySec ?? 20;
  useEffect(() => {
    if (!autoSimulate) return;
    const id = setInterval(() => simulateIncident(), Math.max(5, simulateEverySec) * 1000);
    return () => clearInterval(id);
  }, [autoSimulate, simulateEverySec, simulateIncident]);

  // Optional live backend polling (FastAPI + YOLOv8). No-op in simulation mode.
  useEffect(() => {
    if (!state || !isLiveBackend()) return;
    let since = now();
    const id = setInterval(async () => {
      try {
        const detections = await fetchDetectionsSince(since);
        since = now();
        for (const d of detections) {
          const camera = stateRef.current?.cameras.find(c => c.id === d.camera_id);
          // null (metadata only) still marks the alert as having no snapshot, rather than a simulated scene.
          if (camera) ingestAlert(detectionToAlert(d, camera), snapshotInput(d));
        }
      } catch (error) {
        console.error('Edge API polling failed:', error);
      }
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state === null, ingestAlert]);

  const { user } = useAuth();
  const actorRef = useRef('Unknown operator');
  actorRef.current = user?.name ?? 'Unknown operator';

  const actions = useMemo(() => {
    const mapAlert = (id: string, fn: (a: Alert) => Alert) =>
      update(s => ({ ...s, alerts: s.alerts.map(a => (a.id === id ? fn(a) : a)) }));

    const auditEntry = (text: string) => ({ id: uid('AUD'), at: now(), actor: actorRef.current, text });

    // Invariant kept by every action below: while an alert has an unresolved ticket, the alert is
    // 'dispatched' to the ticket's contractor, and the two are resolved and re-opened together.
    const syncAlertToTicket = (s: AnomalyState, ticket: Ticket, action: string): AnomalyState => ({
      ...s,
      alerts: s.alerts.map(a =>
        a.id === ticket.alertId && a.status !== 'resolved'
          ? withHistory({ ...a, status: 'dispatched', dispatchedTo: ticket.contractorId }, action)
          : a
      ),
    });

    const reopenAlertState = (s: AnomalyState, id: string, action: string): AnomalyState => {
      const alert = s.alerts.find(a => a.id === id);
      if (!alert || alert.status !== 'resolved') return s;
      const ticket = s.tickets.find(t => t.id === alert.ticketId);
      const reopened = withHistory(
        {
          ...alert,
          status: ticket ? 'dispatched' : 'active',
          dispatchedTo: ticket?.contractorId,
          resolvedAt: undefined,
          read: false,
        },
        action
      );
      return {
        ...s,
        alerts: s.alerts.map(a => (a.id === id ? reopened : a)),
        tickets: s.tickets.map(t =>
          t.id === ticket?.id && t.status === 'resolved'
            ? withLog({ ...t, status: 'open', startedAt: undefined, resolvedAt: undefined }, 'Re-opened with alert')
            : t
        ),
      };
    };

    const createTicketFromAlert = (alertId: string, contractorId?: string): Ticket | null => {
      const current = stateRef.current;
      const alert = current?.alerts.find(a => a.id === alertId);
      if (!current || !alert) return null;
      if (alert.ticketId) return current.tickets.find(t => t.id === alert.ticketId) ?? null;
      const contractor = contractorId ?? alert.dispatchedTo ?? defaultContractorFor(alert.detectionClass);
      const camera = current.cameras.find(c => c.id === alert.cameraId);
      const ticket: Ticket = {
        id: `TCK-${1000 + current.tickets.length}`,
        title: `${DETECTION_CLASSES[alert.detectionClass].label} – ${camera?.location ?? alert.cameraName}`,
        alertId: alert.id,
        detectionClass: alert.detectionClass,
        contractorId: contractor,
        status: 'open',
        priority: alert.severity,
        location: camera?.location ?? alert.cameraName,
        createdAt: now(),
        log: [{ at: now(), action: `Raised from ${alert.id}, assigned to ${nameOf(contractor)}` }],
      };
      update(s => {
        const next: AnomalyState = {
          ...s,
          tickets: [ticket, ...s.tickets],
          alerts: s.alerts.map(a =>
            a.id === alertId
              ? withHistory({ ...a, ticketId: ticket.id, read: true }, `Maintenance ticket ${ticket.id} raised`)
              : a
          ),
        };
        return alert.status === 'dispatched' && alert.dispatchedTo === contractor
          ? next
          : syncAlertToTicket(next, ticket, `Dispatched to ${nameOf(contractor)}`);
      });
      toast({ title: `Ticket ${ticket.id} created`, description: `Routed to ${nameOf(contractor)}` });
      return ticket;
    };

    const resolveAlertState = (s: AnomalyState, id: string): AnomalyState => {
      const alert = s.alerts.find(a => a.id === id);
      if (!alert || alert.status === 'resolved') return s;
      const resolved = withHistory({ ...alert, status: 'resolved', resolvedAt: now(), read: true }, 'Resolved');
      return applyRepair({ ...s, alerts: s.alerts.map(a => (a.id === id ? resolved : a)) }, resolved);
    };

    const ticketStatusState = (s: AnomalyState, id: string, status: TicketStatus, patch: Partial<Ticket> = {}): AnomalyState => {
      const ticket = s.tickets.find(t => t.id === id);
      if (!ticket || ticket.status === status) return s;
      const label = { open: 'Re-opened', in_progress: 'Work started', resolved: 'Work completed' }[status];
      const updated = withLog(
        {
          ...ticket,
          ...patch,
          status,
          startedAt: status === 'in_progress' ? now() : status === 'open' ? undefined : ticket.startedAt,
          resolvedAt: status === 'resolved' ? now() : undefined,
        },
        label
      );
      let next: AnomalyState = { ...s, tickets: s.tickets.map(t => (t.id === id ? updated : t)) };
      if (ticket.alertId) {
        if (status === 'resolved') next = resolveAlertState(next, ticket.alertId);
        else if (ticket.status === 'resolved') next = reopenAlertState(next, ticket.alertId, `Re-opened with ${ticket.id}`);
        else next = syncAlertToTicket(next, updated, `Dispatched to ${nameOf(updated.contractorId)}`);
      }
      return next;
    };

    return {
      markAlertRead: (id: string) => mapAlert(id, a => ({ ...a, read: true })),
      markAllAlertsRead: () => update(s => ({ ...s, alerts: s.alerts.map(a => ({ ...a, read: true })) })),
      dispatchAlert: (id: string, contractorId: string) =>
        update(s => {
          const alert = s.alerts.find(a => a.id === id);
          if (!alert) return s;
          return {
            ...s,
            alerts: s.alerts.map(a =>
              a.id === id
                ? withHistory(
                    { ...a, status: a.status === 'resolved' ? a.status : 'dispatched', dispatchedTo: contractorId, read: true },
                    `Dispatched to ${nameOf(contractorId)}`
                  )
                : a
            ),
            // Dispatching someone else moves the linked work order with it.
            tickets: s.tickets.map(t =>
              t.id === alert.ticketId && t.status !== 'resolved' && t.contractorId !== contractorId
                ? withLog(
                    { ...t, contractorId, startedAt: t.status === 'in_progress' ? now() : t.startedAt },
                    `Reassigned from ${nameOf(t.contractorId)} to ${nameOf(contractorId)} (from alert)`
                  )
                : t
            ),
          };
        }),
      resolveAlert: (id: string) =>
        update(s => {
          const next = resolveAlertState(s, id);
          const ticketId = s.alerts.find(a => a.id === id)?.ticketId;
          return {
            ...next,
            tickets: next.tickets.map(t =>
              t.id === ticketId && t.status !== 'resolved'
                ? withLog({ ...t, status: 'resolved', resolvedAt: now() }, 'Closed with alert')
                : t
            ),
          };
        }),
      reopenAlert: (id: string) => update(s => reopenAlertState(s, id, 'Re-opened')),
      createTicketFromAlert,
      setTicketStatus: (id: string, status: TicketStatus) => update(s => ticketStatusState(s, id, status)),
      // Resolves a ticket with its resolution notes and after-fix photo. A real photo arrives already
      // anonymised by the edge service; if it cannot be stored, the ticket is resolved without it.
      resolveTicket: async (id: string, { notes, photo }: { notes: string; photo: SnapshotInput | 'simulated' | null }) => {
        let afterPhoto: AfterPhoto | undefined;
        if (photo === 'simulated') {
          afterPhoto = { status: 'ready', source: 'simulated', capturedAt: now() };
        } else if (photo) {
          try {
            await putSnapshot(afterPhotoKey(id), photo.jpeg);
            afterPhoto = { status: 'ready', source: 'edge', capturedAt: now(), blurMs: photo.blurMs };
          } catch (error) {
            console.error('After-fix photo not stored:', error);
            toast({ variant: 'destructive', title: 'After-fix photo not stored', description: `${id} was resolved without it.` });
          }
        }
        const trimmed = notes.trim();
        update(s => {
          const next = ticketStatusState(s, id, 'resolved', { notes: trimmed || undefined, afterPhoto });
          if (!afterPhoto) return next;
          const how = afterPhoto.source === 'edge' ? 'anonymised at edge' : 'simulated scene';
          return {
            ...next,
            tickets: next.tickets.map(t => (t.id === id ? withLog(t, `After-fix photo attached (${how})`) : t)),
            audit: [auditEntry(`After-fix photo attached: ${id} (${how})`), ...next.audit],
          };
        });
        // A new real photo overwrote any earlier one under the same key. Otherwise drop the earlier photo now:
        // running the purge here would read state from before this update and delete the new photo too.
        if (afterPhoto?.source !== 'edge') deleteSnapshot(afterPhotoKey(id)).catch(() => undefined);
      },
      logAfterPhotoAccess: (ticketId: string, action: 'viewed' | 'exported') =>
        update(s => ({ ...s, audit: [auditEntry(`After-fix photo ${action}: ${ticketId}`), ...s.audit] })),
      logReportExport: (reportId: string, subject: string) =>
        update(s => ({
          ...s,
          audit: [auditEntry(`Report ${reportId} exported for ${subject} by ${actorRef.current} (includes evidence images)`), ...s.audit],
        })),
      reassignTicket: (id: string, contractorId: string) =>
        update(s => {
          const ticket = s.tickets.find(t => t.id === id);
          if (!ticket || ticket.contractorId === contractorId) return s;
          const updated = withLog(
            { ...ticket, contractorId, startedAt: ticket.status === 'in_progress' ? now() : ticket.startedAt },
            `Reassigned from ${nameOf(ticket.contractorId)} to ${nameOf(contractorId)}`
          );
          const next: AnomalyState = { ...s, tickets: s.tickets.map(t => (t.id === id ? updated : t)) };
          return updated.status === 'resolved'
            ? next
            : syncAlertToTicket(next, updated, `Reassigned to ${nameOf(contractorId)} via ${ticket.id}`);
        }),
      toggleCamera: (id: string) =>
        update(s => ({
          ...s,
          cameras: s.cameras.map(c =>
            c.id === id ? { ...c, status: c.status === 'online' ? 'offline' : 'online', lastSeen: now() } : c
          ),
        })),
      updateCamera: (id: string, patch: Partial<Camera>) =>
        update(s => ({ ...s, cameras: s.cameras.map(c => (c.id === id ? { ...c, ...patch } : c)) })),
      logSnapshotAccess: (alertId: string, action: 'viewed' | 'exported') =>
        update(s => ({ ...s, audit: [auditEntry(`Evidence snapshot ${action}: ${alertId}`), ...s.audit] })),
      purgeExpiredSnapshots,
      updateSettings: (patch: Partial<AppSettings>) =>
        update(s => {
          const settings = { ...s.settings, ...patch };
          const changed =
            settings.snapshotRetentionDays !== s.settings.snapshotRetentionDays ||
            settings.resolvedSnapshotRetentionDays !== s.settings.resolvedSnapshotRetentionDays;
          const audit = changed
            ? [
                auditEntry(
                  `Snapshot retention set to ${settings.snapshotRetentionDays} days, or ${settings.resolvedSnapshotRetentionDays} days after resolution.`
                ),
                ...s.audit,
              ]
            : s.audit;
          return { ...s, settings, audit };
        }),
      // Restores the demo data but never the audit trail: the reset itself is logged on top of it.
      // Stored snapshots of the replaced alerts are then deleted as orphans.
      resetDemo: () => {
        setState(s => {
          const seed = buildSeedState();
          const audit = s ? s.audit : seed.audit;
          return {
            ...seed,
            audit: [auditEntry('Demo data reset: alerts, tickets, assets and settings restored to seed.'), ...audit],
          };
        });
        setTimeout(purgeExpiredSnapshots, 0);
      },
    };
  }, [update, purgeExpiredSnapshots]);

  const value = useMemo<AnomalyContextType | undefined>(
    () => (state ? { ...state, tick, simulateIncident, ingestAlert, ...actions } : undefined),
    [state, tick, simulateIncident, ingestAlert, actions]
  );

  if (!value) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading Orbit…
      </div>
    );
  }

  return <AnomalyContext.Provider value={value}>{children}</AnomalyContext.Provider>;
}

export const useAnomaly = () => {
  const context = useContext(AnomalyContext);
  if (context === undefined) {
    throw new Error('useAnomaly must be used within an AnomalyProvider');
  }
  return context;
};
