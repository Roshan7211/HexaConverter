import { Meter } from '@/components/dashboard/charts/meter';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UNIVERSAL_LIMITS, USAGE_PERIOD_DAYS } from '@/lib/plans';
import { formatBytes } from '@/utils';

/**
 * Conversions used against the allowance.
 *
 * Replaces the old subscription panel. The usage figure was the useful half of
 * that card and is unrelated to billing; what has gone is the price comparison
 * and the upgrade prompt, which no longer mean anything.
 */
export function UsagePanel({
  usage,
}: {
  usage: { used: number; limit: number };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your usage</CardTitle>
        <CardDescription>
          Everything is free. These limits exist only to keep the service
          running for everyone.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Meter
          value={usage.used}
          max={usage.limit}
          label={`Conversions (last ${USAGE_PERIOD_DAYS} days)`}
          valueLabel={`${usage.used.toLocaleString()} of ${usage.limit.toLocaleString()}`}
        />

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Max file size</dt>
          <dd className="text-right font-medium">
            {formatBytes(UNIVERSAL_LIMITS.maxFileBytes, 0)}
          </dd>

          <dt className="text-muted-foreground">Files per batch</dt>
          <dd className="text-right font-medium">
            {UNIVERSAL_LIMITS.maxBatchFiles}
          </dd>

          <dt className="text-muted-foreground">Retention</dt>
          <dd className="text-right font-medium">
            {UNIVERSAL_LIMITS.retentionHours} hours
          </dd>

          <dt className="text-muted-foreground">Parallel conversions</dt>
          <dd className="text-right font-medium">
            {UNIVERSAL_LIMITS.concurrentJobs}
          </dd>
        </dl>
      </CardContent>
    </Card>
  );
}
