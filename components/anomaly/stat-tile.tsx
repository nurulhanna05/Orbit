import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// KPI tile. Label first, then the number; colour on the number is only ever a status tone and the icon repeats it.
export function StatTile({
  href,
  icon: Icon,
  label,
  value,
  tone,
  iconClassName,
  children,
}: {
  href?: string;
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  tone?: string;
  iconClassName?: string;
  children?: React.ReactNode;
}) {
  const body = (
    <Card className={cn('h-full p-4', href && 'transition-colors hover:bg-accent')}>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={cn('h-4 w-4 shrink-0', iconClassName)} aria-hidden />
        {label}
      </p>
      <p className={cn('mt-1 text-2xl font-semibold tabular', tone)}>{value}</p>
      {children}
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-lg">
      {body}
    </Link>
  ) : (
    body
  );
}
