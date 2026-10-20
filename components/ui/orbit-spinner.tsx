"use client"

import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/utils';

// The ring is the logo's: an ellipse tilted -57° around the "O". The path is the ring before rotation.
const RING = 'M2 12a10 4 0 1 0 20 0a10 4 0 1 0-20 0';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * Loading indicator in the shape of the logo: a dot orbiting a tilted ring around an "O".
 * `current` (default) draws in the text colour, for buttons and inline use; `brand` uses the logo's
 * gold-to-blue ring, for full-page loading. Under reduced motion the dot holds still (the global CSS rule
 * cannot stop SVG animation, so it is left out instead). Decorative by default; pass `label` to announce it.
 */
export function OrbitSpinner({ className, tone = 'current', label }: { className?: string; tone?: 'current' | 'brand'; label?: string }) {
  const id = `orbit${useId().replace(/:/g, '')}`;
  const reduced = usePrefersReducedMotion();
  const brand = tone === 'brand';
  const ring = brand ? `url(#${id})` : 'currentColor';

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn('h-4 w-4 shrink-0', className)}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {brand && (
        <defs>
          <linearGradient id={id} x1="4" y1="21" x2="20" y2="3" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFC23D" />
            <stop offset="0.5" stopColor="#8FD6FF" />
            <stop offset="1" stopColor="#22A6FF" />
          </linearGradient>
        </defs>
      )}
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="2" />
      <g transform="rotate(-57 12 12)">
        <path d={RING} stroke={ring} strokeWidth="1.5" opacity={brand ? 0.9 : 0.35} />
        <circle r="2.1" fill={brand ? '#22A6FF' : 'currentColor'} cx={reduced ? 22 : 0} cy={reduced ? 12 : 0}>
          {!reduced && <animateMotion dur="1.4s" repeatCount="indefinite" path={RING} />}
        </circle>
      </g>
    </svg>
  );
}
