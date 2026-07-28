import type { Metadata } from 'next';

import { redirect } from 'next/navigation';

import { CheckCircle2, Clock, FileStack, XCircle } from 'lucide-react';

import { CategoryBreakdown } from '@/components/dashboard/charts/category-breakdown';
import { ConversionsChart } from '@/components/dashboard/charts/conversions-chart';
import { StatTile } from '@/components/dashboard/charts/stat-tile';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { buildMetadata } from '@/lib/seo';
import { peekRequester } from '@/services/auth/identity.service';
import { getDashboardStats } from '@/services/stats/stats.service';
import { formatBytes, formatDuration } from '@/utils';

export const metadata: Metadata = buildMetadata({
  title: 'Statistics',
  description: 'Conversion trends, category breakdown and success rate.',
  path: '/dashboard/statistics',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

export default async function StatisticsPage() {
  const requester = await peekRequester();
  if (!requester) redirect('/sign-in?callbackUrl=/dashboard/statistics');

  const stats = await getDashboardStats(requester, 90);
  const { summary } = stats;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={FileStack}
          label="Total conversions"
          value={summary.total.toLocaleString()}
        />
        <StatTile
          icon={CheckCircle2}
          label="Completed"
          tone="success"
          value={summary.completed.toLocaleString()}
          hint={
            summary.successRate === null
              ? undefined
              : `${summary.successRate}% success rate`
          }
        />
        <StatTile
          icon={XCircle}
          label="Failed"
          tone={summary.failed > 0 ? 'destructive' : 'default'}
          value={summary.failed.toLocaleString()}
          hint={
            summary.failed === 0 ? 'No failures' : 'See history for reasons'
          }
        />
        <StatTile
          icon={Clock}
          label="Average duration"
          value={
            summary.avgDurationMs === null
              ? '—'
              : formatDuration(summary.avgDurationMs)
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversions over time</CardTitle>
          <CardDescription>
            Daily volume across the last 90 days. Hover a day for its exact
            counts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summary.total === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              No conversions in this window yet.
            </p>
          ) : (
            <ConversionsChart data={stats.daily} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By category</CardTitle>
            <CardDescription>
              Which converters you use, ranked by volume.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <CategoryBreakdown data={stats.byCategory} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data processed</CardTitle>
            <CardDescription>
              Total bytes in and out across completed conversions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ['Uploaded', formatBytes(summary.bytesIn)],
                ['Produced', formatBytes(summary.bytesOut)],
                [
                  'Size change',
                  summary.bytesSavedPercent === null
                    ? '—'
                    : `${summary.bytesSavedPercent > 0 ? '−' : '+'}${Math.abs(summary.bytesSavedPercent)}%`,
                ],
                ['Files stored now', String(stats.storage.fileCount)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border p-4">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="tabular mt-1 text-xl font-semibold">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-4 text-xs text-muted-foreground">
              A negative size change means the converted files are smaller than
              the originals.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
