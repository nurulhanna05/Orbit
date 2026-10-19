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
import { DETECTION_CLASS_LIST, SEVERITY_META } from '@/lib/anomaly/taxonomy';
import { SeverityIcon } from './status';
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
        <Button size={size} variant={variant} className="gap-2" aria-label={size === 'icon' ? label : undefined}>
          <Zap className="h-4 w-4" aria-hidden />
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
            <SeverityIcon severity={c.defaultSeverity} className="mr-2" />
            {c.label}
            <span className="ml-auto text-xs text-muted-foreground">{SEVERITY_META[c.defaultSeverity].label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
