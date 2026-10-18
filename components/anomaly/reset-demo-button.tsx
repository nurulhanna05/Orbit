"use client"

import { useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { useToast } from '@/hooks/use-toast';

export function ResetDemoButton({ variant = 'outline', size, className }: Pick<ButtonProps, 'variant' | 'size' | 'className'>) {
  const { resetDemo } = useAnomaly();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        Reset demo data
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              Alerts, tickets, asset health and settings go back to the seeded week. The PDPA audit trail is kept, and
              the reset is added to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetDemo();
                toast({ title: 'Demo data reset', description: 'Logged in the audit trail.' });
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
