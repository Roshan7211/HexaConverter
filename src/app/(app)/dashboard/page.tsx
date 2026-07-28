import type { Metadata } from 'next';

import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CheckCircle2, Clock, FileStack, TrendingDown } from 'lucide-react';
import { getServerSession } from 'next-auth';

import { CategoryBreakdown } from '@/components/dashboard/charts/category-breakdown';
import { ConversionsChart } from '@/components/dashboard/charts/conversions-chart';
import { StatTile } from '@/components/dashboard/charts/stat-tile';
import { FavoritesPanel } from '@/components/dashboard/favorites-panel';
import { JobHistory } from '@/components/dashboard/job-history';
import { ProfilePanel } from '@/components/dashboard/profile-panel';
import { QuickConvert } from '@/components/dashboard/quick-convert';
import { StoragePanel } from '@/components/dashboard/storage-panel';
import { UsagePanel } from '@/components/dashboard/usage-panel';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { findById } from '@/database/repositories/user.repository';
import { buildMetadata } from '@/lib/seo';
import { authOptions } from '@/services/auth/auth-options';
import { checkQuota, peekRequester } from '@/services/auth/identity.service';
import { getDashboardStats } from '@/services/stats/stats.service';
import { formatBytes, formatDuration } from '@/utils';

export const metadata: Metadata = buildMetadata({
  title: 'Dashboard',
  description: 'Your conversions, usage and plan at a glance.',
  path: '/dashboard',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/dashboard');

  const requester = await peekRequester();
  if (!requester) redirect('/sign-in?callbackUrl=/dashboard');

  const [user, stats, quota] = await Promise.all([
    findById(session.user.id),
    getDashboardStats(requester, 30),
    checkQuota(requester),
  ]);

  if (!user) redirect('/sign-in');

  const { summary, storage } = stats;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <ProfilePanel
        name={user.name}
        email={user.email}
        image={session.user.image ?? null}
        plan={user.plan}
        memberSince={user.createdAt}
        hasPassword={Boolean(user.passwordHash)}
      />

      {/* Headline figures */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={FileStack}
          label="Total conversions"
          value={summary.total.toLocaleString()}
          hint={
            summary.active > 0 ? `${summary.active} in progress` : 'All settled'
          }
        />
        <StatTile
          icon={CheckCircle2}
          label="Success rate"
          tone={
            summary.successRate === null || summary.successRate >= 90
              ? 'success'
              : summary.successRate >= 70
                ? 'warning'
                : 'destructive'
          }
          value={summary.successRate === null ? '—' : `${summary.successRate}%`}
          hint={
            summary.successRate === null
              ? 'No conversions yet'
              : `${summary.completed} of ${summary.completed + summary.failed} succeeded`
          }
        />
        <StatTile
          icon={TrendingDown}
          label="Size reduction"
          value={
            summary.bytesSavedPercent === null
              ? '—'
              : `${summary.bytesSavedPercent}%`
          }
          hint={`${formatBytes(summary.bytesIn)} in · ${formatBytes(summary.bytesOut)} out`}
        />
        <StatTile
          icon={Clock}
          label="Average duration"
          value={
            summary.avgDurationMs === null
              ? '—'
              : formatDuration(summary.avgDurationMs)
          }
          hint="Per completed conversion"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversions over time</CardTitle>
              <CardDescription>The last 30 days.</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.total === 0 ? (
                <EmptyChart />
              ) : (
                <ConversionsChart data={stats.daily} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Recent conversions</CardTitle>
                <CardDescription>
                  Your latest files and their status.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/conversions">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <JobHistory />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <QuickConvert />
          <UsagePanel usage={{ used: quota.used, limit: quota.limit }} />
          <StoragePanel storage={storage} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <FavoritesPanel compact />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By category</CardTitle>
            <CardDescription>Where your conversions go.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.byCategory.length === 0 ? (
              <EmptyChart />
            ) : (
              <CategoryBreakdown data={stats.byCategory} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="rounded-lg border border-dashed px-4 py-10 text-center">
      <p className="text-sm font-medium">Nothing to chart yet</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Convert a file and your activity will appear here.
      </p>
      <Button size="sm" className="mt-4" asChild>
        <Link href="/convert/image">Start a conversion</Link>
      </Button>
    </div>
  );
}
