import { cn } from '@/lib/utils';

// The wordmark ships in two colourways: navy text for light backgrounds, cream text with a glowing ring for dark.
// Both are rendered and the theme class picks one, so there is no flash or hydration mismatch on load.
export function OrbitLogo({ className, alt = 'Orbit' }: { className?: string; alt?: string }) {
  return (
    <span className={cn('inline-block shrink-0', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain SVG */}
      <img src="/brand/orbit-logo-light.svg" alt={alt} className="h-full w-auto dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain SVG */}
      <img src="/brand/orbit-logo-dark.svg" alt={alt} className="hidden h-full w-auto dark:block" />
    </span>
  );
}
