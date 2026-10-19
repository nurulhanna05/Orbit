"use client"

import { useState } from 'react';
import Link from 'next/link';
import { Pause, Play, TrendingDown, TrendingUp } from 'lucide-react';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { ASSET_TYPE_LABELS } from '@/lib/anomaly/taxonomy';
import { cn } from '@/lib/utils';

export const healthStatus = (pct: number): 'critical' | 'warning' | 'success' =>
  pct < 40 ? 'critical' : pct < 65 ? 'warning' : 'success';

export const healthTone = (pct: number) =>
  ({ critical: 'text-critical-fg', warning: 'text-warning-fg', success: 'text-success-fg' })[healthStatus(pct)];

export const healthBar = (pct: number) => ({ critical: 'bg-critical', warning: 'bg-warning', success: 'bg-success' })[healthStatus(pct)];

// Scrolling strip of the assets most recently affected by detections.
export function AssetHealthTicker() {
  const { assets, wear } = useAnomaly();
  const [paused, setPaused] = useState(false);
  const lastEvent = (id: string) => wear.find(w => w.assetId === id);
  const items = [...assets].sort((a, b) => {
    const ea = lastEvent(a.id)?.at ?? '';
    const eb = lastEvent(b.id)?.at ?? '';
    return eb.localeCompare(ea) || a.healthPct - b.healthPct;
  });

  // The second copy only exists to make the loop seamless, so it is hidden from assistive tech and the tab order.
  const strip = (copy: boolean) => items.map(a => {
    const ev = lastEvent(a.id);
    const up = ev && ev.healthDeltaPct > 0;
    return (
      <Link
        key={a.id + (copy ? '-copy' : '')}
        href="/dashboard/assets"
        tabIndex={copy ? -1 : undefined}
        className="flex shrink-0 items-center gap-2 border-r px-4 text-xs hover:underline max-md:min-h-11"
      >
        <span className="font-medium">{a.name}</span>
        <span className="text-muted-foreground">{ASSET_TYPE_LABELS[a.type]}</span>
        <span className={cn('font-semibold tabular', healthTone(a.healthPct))}>{a.healthPct}%</span>
        {ev && (
          <span className="flex items-center gap-0.5 tabular text-muted-foreground">
            {up ? <TrendingUp className="h-3 w-3" aria-label="up" /> : <TrendingDown className="h-3 w-3" aria-label="down" />}
            {Math.abs(ev.healthDeltaPct)}
          </span>
        )}
        <span className="text-muted-foreground">about {a.remainingLifeMonths} months left</span>
      </Link>
    );
  });

  return (
    <section aria-label="Asset health ticker" className="group flex items-center overflow-hidden rounded-md border bg-card">
      <span className="z-10 shrink-0 border-r px-3 py-2 text-xs font-semibold uppercase tracking-wide">Asset health</span>
      {/* Pauses on hover, on keyboard focus, and with the button. Under reduced motion it does not move at all and scrolls by hand. */}
      <div className="flex min-w-0 flex-1 overflow-hidden py-2 motion-reduce:overflow-x-auto">
        <div
          className={cn(
            'flex animate-ticker group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:animate-none',
            paused && '[animation-play-state:paused]'
          )}
        >
          {strip(false)}
          <div aria-hidden className="flex motion-reduce:hidden">{strip(true)}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused(p => !p)}
        aria-label={paused ? 'Resume asset ticker' : 'Pause asset ticker'}
        aria-pressed={paused}
        className="z-10 flex h-9 w-9 shrink-0 items-center justify-center border-l text-muted-foreground hover:bg-accent hover:text-foreground motion-reduce:hidden max-md:h-11 max-md:w-11"
      >
        {paused ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
      </button>
    </section>
  );
}
