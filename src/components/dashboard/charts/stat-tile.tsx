import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/utils';

/**
 * A headline number.
 *
 * Per the form guidance, a single current value is a stat tile — not a
 * one-bar chart. The value uses tabular figures so a row of tiles aligns.
 */
export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
  className?: string;
}) {
  const toneClass = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
  }[tone];

  return (
    <Card className={className}>
      <CardContent className="flex items-start gap-4 p-5">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl',
            toneClass,
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="tabular mt-0.5 truncate text-2xl font-semibold">
            {value}
          </p>
          {hint ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {hint}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
