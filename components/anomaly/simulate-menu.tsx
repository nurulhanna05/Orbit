"use client"

import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { DETECTION_CLASS_LIST } from '@/lib/anomaly/taxonomy';
import type { ButtonProps } from '@/components/ui/button';

export function SimulateMenu({
  cameraId,
  label = 'Simulate incident',
  size = 'sm',
  variant = 'outline',
}: {
  cameraId?: string;
  label?: string;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
}) {
  const { simulateIncident, cameras } = useAnomaly();
  const camera = cameras.find(c => c.id === cameraId);
  const classes = camera ? DETECTION_CLASS_LIST.filter(c => camera.enabledClasses.includes(c.id)) : DETECTION_CLASS_LIST;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} className="gap-1.5">
          <Zap className="h-4 w-4 text-amber-500" />
          {size !== 'icon' && label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{camera ? `Simulate on ${camera.name}` : 'Simulate a township incident'}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => simulateIncident(undefined, cameraId)}>
          <span className="font-medium">Random incident</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {classes.map(c => (
          <DropdownMenuItem key={c.id} onClick={() => simulateIncident(c.id, cameraId)}>
            <span className="h-2.5 w-2.5 rounded-full mr-2" style={{ backgroundColor: c.color }} />
            {c.label}
            <code className="ml-auto text-[10px] text-muted-foreground">{c.id}</code>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
