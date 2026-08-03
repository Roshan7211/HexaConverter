'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

/** Toast host, themed from the active colour scheme. */
export function Toaster(props: ToasterProps) {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      // `!w-auto` below 600px undoes a bug in sonner's own stylesheet, which
      // sets `left`, `right` *and* `width: 100%` on the fixed container at that
      // breakpoint. Width wins over `right`, so the toaster ends up a full
      // viewport wide starting at the left offset and hangs that same offset
      // off the right edge — on a 412px phone the toast is cut off and its
      // close button sits outside the card. With `width: auto` the two offsets
      // determine the width, which is what the rule intended.
      className="toaster group max-[600px]:!w-auto"
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          error: 'group-[.toaster]:border-destructive/40',
          success: 'group-[.toaster]:border-success/40',
        },
      }}
      {...props}
    />
  );
}
