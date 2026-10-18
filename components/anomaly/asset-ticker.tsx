"use client"

import Link from 'next/link';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { ASSET_TYPE_LABELS } from '@/lib/anomaly/taxonomy';
import { cn } from '@/lib/utils';

export const healthTone = (pct: number) =>
  pct < 40 ? 'text-red-600 dark:text-red-400' : pct < 65 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';

export const healthBar = (pct: number) => (pct < 40 ? 'bg-red-500' : pct < 65 ? 'bg-amber-500' : 'bg-emerald-500');

// Scrolling strip of the assets most recently affected by detections.
export function AssetHealthTicker() {
  const { assets, wear } = useAnomaly();
  const lastEvent = (id: string) => wear.find(w => w.assetId === id);
  const items = [...assets].sort((a, b) => {
    const ea = lastEvent(a.id)?.at ?? '';
    const eb = lastEvent(b.id)?.at ?? '';
    return eb.localeCompare(ea) || a.healthPct - b.healthPct;
  });

  const strip = (suffix: string) => items.map(a => {
    const ev = lastEvent(a.id);
    const up = ev && ev.healthDeltaPct > 0;
    return (
      <Link key={a.id + suffix} href="/dashboard/assets" className="flex shrink-0 items-center gap-2 px-4 text-xs hover:underline">
        <span className="font-medium">{a.name}</span>
        <span className="text-muted-foreground">{ASSET_TYPE_LABELS[a.type]}</span>
        <span className={cn('font-semibold tabular-nums', healthTone(a.healthPct))}>{a.healthPct}%</span>
        {ev && (
          <span className={cn('flex items-center gap-0.5 tabular-nums', up ? 'text-emerald-600' : 'text-red-600')}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(ev.healthDeltaPct)}
          </span>
        )}
        <span className="text-muted-foreground">~{a.remainingLifeMonths} mo left</span>
        <span className="text-muted-foreground/50">|</span>
      </Link>
    );
  });

  return (
    <div className="group relative flex items-center overflow-hidden rounded-md border bg-muted/30">
      <span className="z-10 shrink-0 border-r bg-background px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
        Asset health
      </span>
      <div className="flex overflow-hidden py-2">
        <div className="flex animate-ticker group-hover:[animation-play-state:paused]">
          {strip("a")}
          {strip("b")}
        </div>
      </div>
    </div>
  );
}
