'use client';

import type { ReactNode } from 'react';

import { ThemeProvider } from '@/components/providers/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';

/** Single mount point for every client-side context the app needs. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </ThemeProvider>
  );
}
