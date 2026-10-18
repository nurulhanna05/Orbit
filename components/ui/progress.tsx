'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

// Plain implementation: @radix-ui/react-progress's bundle is mis-minified by Next 13.5's SWC minifier.
type ProgressProps = React.HTMLAttributes<HTMLDivElement> & { value?: number | null; max?: number };

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(({ className, value, max = 100, ...props }, ref) => {
  const pct = Math.max(0, Math.min(100, ((value ?? 0) / max) * 100));
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value ?? undefined}
      className={cn('relative h-4 w-full overflow-hidden rounded-full bg-secondary', className)}
      {...props}
    >
      <div className="h-full w-full flex-1 bg-primary transition-all" style={{ transform: `translateX(-${100 - pct}%)` }} />
    </div>
  );
});
Progress.displayName = 'Progress';

export { Progress };
