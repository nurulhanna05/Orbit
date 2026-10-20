"use client"

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MonitorPlay,
  Siren,
  Ticket,
  Gauge,
  BarChart3,
  Camera,
  Activity,
  FlaskConical,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAnomaly } from '@/components/providers/anomaly-provider';

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: 'alerts' | 'tickets';
};

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Operations',
    items: [
      { title: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { title: 'Live Zones', href: '/dashboard/cameras/live', icon: MonitorPlay },
      { title: 'Alerts', href: '/dashboard/alerts', icon: Siren, badge: 'alerts' },
      { title: 'Maintenance Tickets', href: '/dashboard/tickets', icon: Ticket, badge: 'tickets' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { title: 'Asset Health', href: '/dashboard/assets', icon: Gauge },
      { title: 'Analytics & Reports', href: '/dashboard/analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { title: 'Cameras', href: '/dashboard/cameras', icon: Camera },
      { title: 'Edge & IoT Health', href: '/dashboard/health', icon: Activity },
      { title: 'Model Sandbox', href: '/dashboard/sandbox', icon: FlaskConical },
      { title: 'Settings', href: '/dashboard/settings', icon: Settings },
    ],
  },
];

export default function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { alerts, tickets } = useAnomaly();
  const counts = {
    alerts: alerts.filter(a => a.status !== 'resolved').length,
    tickets: tickets.filter(t => t.status !== 'resolved').length,
  };

  // Longest matching prefix wins, so /dashboard/cameras/live doesn't also highlight /dashboard/cameras.
  const activeHref = NAV_SECTIONS.flatMap(s => s.items)
    .map(i => i.href)
    .filter(href => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {NAV_SECTIONS.map(section => (
        <div key={section.label} className="flex flex-col gap-1">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {section.label}
          </p>
          {section.items.map(item => {
            const Icon = item.icon;
            const count = item.badge ? counts[item.badge] : 0;
            const active = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'relative w-full justify-start gap-3 font-normal',
                  // Active item: Orbit-blue indicator bar plus weight, so it never relies on colour alone.
                  active
                    ? 'bg-accent font-semibold text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:bg-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1 text-left">{item.title}</span>
                {count > 0 && (
                  <Badge
                    variant={item.badge === 'alerts' ? 'default' : 'secondary'}
                    className="min-w-5 justify-center px-1.5"
                    aria-label={`${count} open`}
                  >
                    {count}
                  </Badge>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
