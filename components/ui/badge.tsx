import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium tabular transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-foreground text-background',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'border-foreground/20 text-foreground',
        // Status badges: always render with an icon and a text label (see components/anomaly/status.tsx).
        critical: 'border-critical/30 bg-critical-soft text-critical-fg',
        warning: 'border-warning/40 bg-warning-soft text-warning-fg',
        info: 'border-info/30 bg-info-soft text-info-fg',
        success: 'border-success/30 bg-success-soft text-success-fg',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
