"use client"

import { useId, useMemo } from 'react';
import { ShieldCheck, Users, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Alert, BoundingBox, Camera, DetectionClass } from '@/lib/types';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { SCENES, Rect } from '@/lib/anomaly/scenes';
import { ambientBoxes } from '@/lib/anomaly/simulator';
import { DETECTION_CLASSES, ZONE_LABELS, formatConfidence } from '@/lib/anomaly/taxonomy';

// Scene is drawn in a 160x90 viewBox; frame percentages map with these factors.
const X = (p: number) => p * 1.6;
const Y = (p: number) => p * 0.9;

const SKIN = '#d6a77a';

type SceneProps = {
  camera: Camera;
  boxes: BoundingBox[];
  active: Set<DetectionClass>;
  privacy: boolean;
};

function Lamp({ r, lit, ceiling, gid }: { r: Rect; lit: boolean; ceiling?: boolean; gid: string }) {
  if (ceiling) {
    return (
      <g>
        {lit && <ellipse cx={X(r.x + r.w / 2)} cy={Y(r.y + r.h) + 14} rx={30} ry={18} fill={`url(#${gid}-glow)`} />}
        <rect x={X(r.x)} y={Y(r.y)} width={X(r.w)} height={Y(r.h) * 0.6} rx={1} fill={lit ? '#fef9c3' : '#334155'} />
      </g>
    );
  }
  const cx = X(r.x + r.w / 2);
  return (
    <g>
      <rect x={cx - 0.8} y={Y(r.y) + 3} width={1.6} height={Y(r.h) - 3} fill="#475569" />
      <rect x={cx - 5} y={Y(r.y)} width={10} height={3} rx={1.5} fill={lit ? '#fde68a' : '#1e293b'} />
      {lit && <ellipse cx={cx} cy={Y(r.y) + 14} rx={16} ry={20} fill={`url(#${gid}-glow)`} />}
    </g>
  );
}

function Pipe({ r, leaking }: { r: Rect; leaking: boolean }) {
  const vertical = r.h > r.w;
  return (
    <g>
      {vertical ? (
        <rect x={X(r.x + r.w / 2) - 1.5} y={Y(r.y)} width={3} height={Y(r.h)} fill="#64748b" />
      ) : (
        <rect x={X(r.x)} y={Y(r.y + r.h / 2) - 1.5} width={X(r.w)} height={3} fill="#64748b" />
      )}
      {leaking && (
        <g>
          <ellipse cx={X(r.x + r.w / 2)} cy={Y(r.y + r.h) - 1} rx={X(r.w) * 0.6} ry={3} fill="#38bdf8" opacity={0.75} />
          {[0, 1, 2].map(i => (
            <circle key={i} cx={X(r.x + r.w / 2) + (i - 1) * 2} cy={Y(r.y + r.h * 0.5) + i * 3} r={0.8} fill="#7dd3fc" />
          ))}
        </g>
      )}
    </g>
  );
}

function Bins({ r, overflow, many }: { r: Rect; overflow: boolean; many: boolean }) {
  const count = many ? 3 : 1;
  const w = X(r.w) / count;
  return (
    <g>
      {Array.from({ length: count }).map((_, i) => {
        const x = X(r.x) + i * w + 1;
        const top = Y(r.y + r.h * 0.35);
        return (
          <g key={i}>
            <rect x={x} y={top} width={w - 2} height={Y(r.y + r.h) - top} rx={1} fill="#15803d" />
            <rect x={x - 0.5} y={top - 1.5} width={w - 1} height={1.5} fill="#166534" />
            {overflow && (
              <g>
                <circle cx={x + w * 0.3} cy={top - 3} r={3.2} fill="#1f2937" />
                <circle cx={x + w * 0.65} cy={top - 4} r={3.6} fill="#374151" />
                <circle cx={x + w * 0.5} cy={top - 6.5} r={2.6} fill="#111827" />
              </g>
            )}
          </g>
        );
      })}
      {overflow && (
        <g>
          <circle cx={X(r.x) - 2} cy={Y(r.y + r.h) - 2} r={2.4} fill="#374151" />
          <rect x={X(r.x + r.w) + 1} y={Y(r.y + r.h) - 3} width={4} height={3} fill="#78716c" />
        </g>
      )}
    </g>
  );
}

function Ramp({ r }: { r: Rect }) {
  const x0 = X(r.x);
  const x1 = X(r.x + r.w);
  const y0 = Y(r.y);
  const y1 = Y(r.y + r.h);
  return (
    <g>
      <polygon points={`${x0},${y1} ${x1},${y1} ${x1},${y0 + 4} ${x0 + 6},${y0 + 4}`} fill="#94a3b8" />
      <rect x={x0 + (x1 - x0) / 2 - 4} y={y0 + (y1 - y0) / 2} width={8} height={8} rx={1} fill="#2563eb" />
      <circle cx={x0 + (x1 - x0) / 2} cy={y0 + (y1 - y0) / 2 + 2.5} r={1} fill="#fff" />
      <path
        d={`M${x0 + (x1 - x0) / 2 - 1.5},${y0 + (y1 - y0) / 2 + 4} a2.2,2.2 0 1,0 3,1.5`}
        stroke="#fff"
        strokeWidth={0.7}
        fill="none"
      />
    </g>
  );
}

function Car({ b, color = '#ea580c' }: { b: { x: number; y: number; w: number; h: number }; color?: string }) {
  const x = X(b.x);
  const y = Y(b.y);
  const w = X(b.w);
  const h = Y(b.h);
  return (
    <g>
      <rect x={x + w * 0.2} y={y + h * 0.15} width={w * 0.55} height={h * 0.35} rx={2} fill={color} opacity={0.85} />
      <rect x={x} y={y + h * 0.42} width={w} height={h * 0.38} rx={2.5} fill={color} />
      <rect x={x + w * 0.27} y={y + h * 0.22} width={w * 0.4} height={h * 0.18} fill="#bae6fd" opacity={0.8} />
      <circle cx={x + w * 0.22} cy={y + h * 0.85} r={h * 0.14} fill="#111827" />
      <circle cx={x + w * 0.78} cy={y + h * 0.85} r={h * 0.14} fill="#111827" />
      {/* Plate masked */}
      <rect x={x + w * 0.4} y={y + h * 0.62} width={w * 0.2} height={h * 0.1} fill="#64748b" />
    </g>
  );
}

function Head({ cx, cy, r, privacy, gid }: { cx: number; cy: number; r: number; privacy: boolean; gid: string }) {
  if (privacy) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={r * 1.35} fill={`url(#${gid}-mosaic)`} filter={`url(#${gid}-blur)`} />
        <circle cx={cx} cy={cy} r={r * 1.35} fill="none" stroke="#10b981" strokeWidth={0.4} strokeDasharray="1 1" />
      </g>
    );
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={SKIN} />
      <circle cx={cx - r * 0.35} cy={cy - r * 0.1} r={r * 0.12} fill="#1f2937" />
      <circle cx={cx + r * 0.35} cy={cy - r * 0.1} r={r * 0.12} fill="#1f2937" />
    </g>
  );
}

function Pedestrian({ b, privacy, gid, hue }: { b: BoundingBox; privacy: boolean; gid: string; hue: string }) {
  const cx = X(b.x + b.w / 2);
  const top = Y(b.y);
  const h = Y(b.h);
  const headR = 1.9;
  return (
    <g>
      <rect x={cx - 2.2} y={top + headR * 2 + 0.5} width={4.4} height={h * 0.45} rx={1.5} fill={hue} />
      <rect x={cx - 2} y={top + headR * 2 + h * 0.45} width={1.6} height={h * 0.38} fill="#1e293b" />
      <rect x={cx + 0.4} y={top + headR * 2 + h * 0.45} width={1.6} height={h * 0.38} fill="#1e293b" />
      <Head cx={cx} cy={top + headR + 0.3} r={headR} privacy={privacy} gid={gid} />
    </g>
  );
}

function Fallen({ b, privacy, gid }: { b: BoundingBox; privacy: boolean; gid: string }) {
  const x = X(b.x);
  const y = Y(b.y + b.h / 2);
  const w = X(b.w);
  return (
    <g>
      <rect x={x + 1} y={y - 1.4} width={w * 0.4} height={2.8} fill="#1e293b" />
      <rect x={x + w * 0.38} y={y - 2.2} width={w * 0.4} height={4.4} rx={1.5} fill="#be123c" />
      <Head cx={X(b.faceRegion?.x ?? b.x + b.w)} cy={Y(b.faceRegion?.y ?? b.y)} r={1.9} privacy={privacy} gid={gid} />
    </g>
  );
}

const SHIRTS = ['#0ea5e9', '#a855f7', '#f59e0b', '#14b8a6', '#ef4444', '#6366f1', '#84cc16'];

export function ZoneScene({ camera, boxes, active, privacy }: SceneProps) {
  const gid = `s${useId().replace(/:/g, '')}`;
  const scene = SCENES[camera.zone];
  const night = scene.night;
  const lit = !active.has('lamp_off');
  const zone = camera.zone;

  return (
    <svg viewBox="0 0 160 90" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id={`${gid}-sky`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={night ? '#0b1120' : '#7dd3fc'} />
          <stop offset="1" stopColor={night ? '#1e293b' : '#e0f2fe'} />
        </linearGradient>
        <radialGradient id={`${gid}-glow`}>
          <stop offset="0" stopColor="#fde68a" stopOpacity={night ? 0.55 : 0.25} />
          <stop offset="1" stopColor="#fde68a" stopOpacity={0} />
        </radialGradient>
        <pattern id={`${gid}-mosaic`} width="1.6" height="1.6" patternUnits="userSpaceOnUse">
          <rect width="1.6" height="1.6" fill="#a8a29e" />
          <rect width="0.8" height="0.8" fill="#d6d3d1" />
          <rect x="0.8" y="0.8" width="0.8" height="0.8" fill="#78716c" />
        </pattern>
        <filter id={`${gid}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
      </defs>

      {zone === 'corridor' ? (
        <g>
          <rect width="160" height="90" fill={lit ? '#cbd5e1' : '#334155'} />
          <polygon points="0,0 160,0 110,22 50,22" fill={lit ? '#e2e8f0' : '#1e293b'} />
          <polygon points="0,90 160,90 110,58 50,58" fill={lit ? '#a8a29e' : '#292524'} />
          <polygon points="0,0 50,22 50,58 0,90" fill={lit ? '#94a3b8' : '#1e293b'} />
          <polygon points="160,0 110,22 110,58 160,90" fill={lit ? '#94a3b8' : '#1e293b'} />
          <rect x="50" y="22" width="60" height="36" fill={lit ? '#f1f5f9' : '#0f172a'} />
          <rect x="120" y="28" width="22" height="34" fill="#0ea5e9" opacity={0.35} />
          <rect x="18" y="28" width="22" height="34" fill="#f97316" opacity={0.3} />
        </g>
      ) : (
        <g>
          <rect width="160" height="90" fill={`url(#${gid}-sky)`} />
          {night && [12, 40, 70, 104, 140].map((sx, i) => <circle key={sx} cx={sx} cy={6 + (i % 3) * 5} r={0.4} fill="#e2e8f0" />)}
          <rect
            y="45"
            width="160"
            height="45"
            fill={
              zone === 'jogging_track' || zone === 'playground'
                ? night ? '#14532d' : '#4ade80'
                : night ? '#374151' : '#9ca3af'
            }
          />
          {(zone === 'jogging_track' || zone === 'playground') &&
            [10, 30, 55, 95, 125, 148].map((tx, i) => (
              <g key={tx}>
                <rect x={tx - 0.8} y={34 + (i % 2) * 3} width={1.6} height={10} fill="#713f12" />
                <circle cx={tx} cy={32 + (i % 2) * 3} r={6} fill={night ? '#166534' : '#16a34a'} />
              </g>
            ))}
        </g>
      )}

      {zone === 'jogging_track' && (
        <path d="M-5,80 Q80,52 165,72 L165,62 Q80,44 -5,70 Z" fill={night ? '#7c2d12' : '#c2410c'} opacity={0.9} />
      )}
      {zone === 'playground' && (
        <g>
          <rect x="60" y="66" width="44" height="14" rx="3" fill="#fde68a" opacity={0.8} />
          <polygon points="68,46 74,46 92,68 86,68" fill="#ef4444" />
          <rect x="66" y="46" width="2" height="22" fill="#2563eb" />
          <rect x="110" y="40" width="1.5" height="26" fill="#475569" />
          <rect x="132" y="40" width="1.5" height="26" fill="#475569" />
          <rect x="110" y="40" width="23.5" height="1.5" fill="#475569" />
          <rect x="118" y="56" width="7" height="1.5" fill="#f59e0b" />
        </g>
      )}
      {zone === 'bin_bay' && (
        <g>
          <rect x="0" y="18" width="160" height="38" fill={night ? '#475569' : '#cbd5e1'} />
          <rect x="0" y="16" width="160" height="3" fill="#64748b" />
          <rect x="92" y="28" width="30" height="28" fill="#78716c" />
        </g>
      )}
      {zone === 'main_gate' && (
        <g>
          <rect x="0" y="62" width="160" height="28" fill="#4b5563" />
          {[20, 50, 80, 110, 140].map(d => (
            <rect key={d} x={d} y="75" width="10" height="1.2" fill="#facc15" />
          ))}
          <rect x="44" y="22" width="5" height="40" fill="#d6d3d1" />
          <rect x="94" y="22" width="5" height="40" fill="#d6d3d1" />
          <rect x="40" y="18" width="63" height="7" fill="#57534e" />
          <text x="71.5" y="23.5" textAnchor="middle" fontSize="4" fill="#fef3c7" fontWeight="bold">
            CITY OF ELMINA
          </text>
          <rect x="49" y="50" width="45" height="1.2" fill="#ef4444" />
          <rect x="26" y="40" width="14" height="14" fill="#e7e5e4" />
        </g>
      )}
      {zone === 'car_park' && (
        <g>
          {[40, 64, 88, 112, 136].map(px => (
            <rect key={px} x={px} y="58" width="1" height="26" fill="#f8fafc" opacity={0.8} />
          ))}
          <Car b={{ x: 27, y: 60, w: 13, h: 20 }} color="#64748b" />
          <Car b={{ x: 57, y: 60, w: 13, h: 20 }} color="#e2e8f0" />
          <Car b={{ x: 72, y: 60, w: 13, h: 20 }} color="#1d4ed8" />
        </g>
      )}

      {(zone === 'main_gate' || zone === 'car_park') && <Ramp r={scene.ramp} />}
      <Pipe r={scene.pipe} leaking={active.has('pipe_leak')} />
      <Bins r={scene.bin} overflow={active.has('bin_overflow')} many={zone === 'bin_bay'} />
      <Lamp r={scene.lamp} lit={lit} ceiling={zone === 'corridor'} gid={gid} />
      {!lit && zone !== 'corridor' && <rect width="160" height="90" fill="#020617" opacity={0.28} />}

      {boxes.map((b, i) => {
        if (b.kind === 'vehicle') return <Car key={i} b={b} />;
        if (b.kind !== 'pedestrian') return null;
        if (b.label.startsWith('Fallen')) return <Fallen key={i} b={b} privacy={privacy} gid={gid} />;
        return <Pedestrian key={i} b={b} privacy={privacy} gid={gid} hue={SHIRTS[i % SHIRTS.length]} />;
      })}
    </svg>
  );
}

function boxColor(b: BoundingBox, cls?: DetectionClass) {
  if (cls && b.kind !== 'pedestrian') return DETECTION_CLASSES[cls].color;
  if (b.kind === 'pedestrian') return b.label.startsWith('Fallen') ? DETECTION_CLASSES.person_fallen.color : '#10b981';
  if (b.kind === 'vehicle') return '#f97316';
  return '#eab308';
}

export function displayLabel(b: BoundingBox, privacy: boolean) {
  // Labels are always anonymous; with the shield off we just stop claiming the face is blurred.
  const label = privacy ? b.label : b.label.replace(' (Face Blurred)', '');
  return `${label} · ${formatConfidence(b.confidence)}`;
}

export function useCameraFeed(camera: Camera) {
  const { alerts, tick } = useAnomaly();
  return useMemo(() => {
    const open = alerts.filter(a => a.cameraId === camera.id && a.status !== 'resolved');
    const active = new Set(open.map(a => a.detectionClass));
    const incident: { box: BoundingBox; alert: Alert }[] = [];
    for (const a of open) for (const box of a.boxes) incident.push({ box, alert: a });
    const ambient = active.has('crowd_density') ? [] : ambientBoxes(camera, tick);
    return { open, active, incident, ambient };
  }, [alerts, camera, tick]);
}

export default function ZoneFeed({
  camera,
  className,
  showLabels = true,
  large = false,
}: {
  camera: Camera;
  className?: string;
  showLabels?: boolean;
  large?: boolean;
}) {
  const { settings } = useAnomaly();
  const { active, incident, ambient } = useCameraFeed(camera);
  const privacy = settings.privacyShield;
  const offline = camera.status === 'offline';
  const sceneBoxes = [...ambient, ...incident.map(i => i.box)];
  const overlay: { box: BoundingBox; cls?: DetectionClass }[] = [
    ...ambient.map(box => ({ box })),
    ...incident.map(i => ({ box: i.box, cls: i.alert.detectionClass })),
  ];

  return (
    <div className={cn('relative aspect-video w-full overflow-hidden bg-black select-none', className)}>
      {offline ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[repeating-linear-gradient(45deg,#0f172a,#0f172a_6px,#111827_6px,#111827_12px)] text-slate-400">
          <WifiOff className="h-6 w-6" />
          <span className="text-xs font-mono tracking-widest">NO SIGNAL · {camera.id}</span>
        </div>
      ) : (
        <>
          <ZoneScene camera={camera} boxes={sceneBoxes} active={active} privacy={privacy} />
          {overlay.map(({ box, cls }, i) => {
            const color = boxColor(box, cls);
            return (
              <div
                key={i}
                className="absolute border-[1.5px] rounded-[2px]"
                style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`, borderColor: color }}
              >
                {showLabels && (cls || large) && (
                  <span
                    className={cn(
                      'absolute left-[-1.5px] bottom-full whitespace-nowrap rounded-t-[2px] px-1 font-medium text-white',
                      large ? 'text-[11px] py-0.5' : 'text-[9px]'
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {displayLabel(box, privacy)}
                  </span>
                )}
              </div>
            );
          })}
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.08),rgba(0,0,0,0.08)_1px,transparent_1px,transparent_3px)]" />
        </>
      )}

      <div className="absolute top-1.5 left-1.5 flex flex-wrap items-center gap-1">
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white',
            offline ? 'bg-slate-600' : 'bg-red-600'
          )}
        >
          {offline ? 'OFFLINE' : '● LIVE'}
        </span>
        <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">{ZONE_LABELS[camera.zone]}</span>
      </div>
      {!offline && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
          <span className="flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white" title="Anonymous head-count">
            <Users className="h-3 w-3" />
            {active.has('crowd_density') ? incident.filter(i => i.box.kind === 'pedestrian').length : camera.crowdCount}
          </span>
          {privacy && (
            <span className="flex items-center gap-1 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] text-white">
              <ShieldCheck className="h-3 w-3" />
              {large ? 'Faces anonymised' : 'PDPA'}
            </span>
          )}
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">
        {camera.id} · {new Date(camera.lastSeen).toLocaleTimeString('en-MY', { hour12: false })}
      </div>
    </div>
  );
}
