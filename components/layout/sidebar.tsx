"use client"

import { motion } from 'framer-motion';
import NavLinks from './nav-links';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { ShieldCheck, EyeOff } from 'lucide-react';

export default function Sidebar() {
  const { settings } = useAnomaly();

  return (
    <div className="hidden md:flex fixed top-16 h-[calc(100vh-4rem)] w-64 flex-col border-r bg-background">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col h-full p-4 pt-6 overflow-y-auto"
      >
        <NavLinks />
        <div className="mt-auto pt-6">
          <div
            className={
              settings.privacyShield
                ? 'rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                : 'rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200'
            }
          >
            <div className="flex items-center gap-1.5 font-semibold">
              {settings.privacyShield ? <ShieldCheck className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              PDPA by design
            </div>
            <p className="mt-1 leading-relaxed opacity-90">
              Detects object states, hazards and anonymous behaviour. Never identities. No face templates are stored.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
