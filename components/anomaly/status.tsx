import { CircleCheck, Info, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { Severity } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Status is never shown by colour alone: every tone has its own icon shape and a text label.
export type StatusTone = 'critical' | 'warning' | 'info' | 'success' | 'neutral';

export const TONE_ICON: Record<StatusTone, LucideIcon> = {
  critical: OctagonAlert,
  warning: TriangleAlert,
  info: Info,
  success: CircleCheck,
  neutral: Info,
};

export const TONE_TEXT: Record<StatusTone, string> = {
  critical: 'text-critical-fg',
  warning: 'text-warning-fg',
  info: 'text-info-fg',
  success: 'text-success-fg',
  neutral: 'text-muted-foreground',
};

// Solid fills for icons, bars and chart marks (graphics, 3:1 against the card).
export const TONE_FILL: Record<StatusTone, string> = {
  critical: 'bg-critical',
  warning: 'bg-warning',
  info: 'bg-info',
  success: 'bg-success',
  neutral: 'bg-chart-muted',
};

// For SVG fills in charts. Recharts writes these into `fill` attributes, which resolve CSS variables in modern browsers.
export const TONE_CHART: Record<StatusTone, string> = {
  critical: 'hsl(var(--critical))',
  warning: 'hsl(var(--warning))',
  info: 'hsl(var(--info))',
  success: 'hsl(var(--success))',
  neutral: 'hsl(var(--chart-muted))',
};

// Camera overlays sit on a drawn scene that looks the same in both themes, so they use fixed light-theme hexes.
// Label text colour is chosen per fill for at least 4.5:1.
export const TONE_OVERLAY: Record<Exclude<StatusTone, 'success'>, { fill: string; text: string }> = {
  critical: { fill: '#B91C1C', text: '#FFFFFF' },
  warning: { fill: '#D97706', text: '#1C1917' },
  info: { fill: '#475569', text: '#FFFFFF' },
  neutral: { fill: '#E7E5E4', text: '#1C1917' },
};

const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Critical', warning: 'Warning', info: 'Info' };

export function StatusBadge({ tone, children, className }: { tone: StatusTone; children: React.ReactNode; className?: string }) {
  const Icon = TONE_ICON[tone];
  return (
    <Badge variant={tone === 'neutral' ? 'outline' : tone} className={className}>
      <Icon aria-hidden />
      {children}
    </Badge>
  );
}

export function SeverityBadge({ severity, className, children }: { severity: Severity; className?: string; children?: React.ReactNode }) {
  return (
    <StatusBadge tone={severity} className={className}>
      {children ?? SEVERITY_LABEL[severity]}
    </StatusBadge>
  );
}

// Inline icon for lists where a full badge would be too heavy; the label still sits next to it in text.
export function SeverityIcon({ severity, className }: { severity: Severity; className?: string }) {
  const Icon = TONE_ICON[severity];
  return <Icon aria-label={SEVERITY_LABEL[severity]} className={cn('h-4 w-4 shrink-0', TONE_TEXT[severity], className)} />;
}
