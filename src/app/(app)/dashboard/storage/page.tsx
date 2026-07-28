import type { Metadata } from 'next';

import { redirect } from 'next/navigation';

import { JobHistory } from '@/components/dashboard/job-history';
import { StoragePanel } from '@/components/dashboard/storage-panel';
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

export const metadata: Metadata = buildMetadata({
  title: 'Storage',
  description: 'What is stored right now and when it will be deleted.',
  path: '/dashboard/storage',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

export default async function StoragePage() {
  const requester = await peekRequester();
  if (!requester) redirect('/sign-in?callbackUrl=/dashboard/storage');

  const { storage } = await getDashboardStats(requester, 30);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <StoragePanel storage={storage} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Files available to download</CardTitle>
          <CardDescription>
            Completed conversions still inside their retention window.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JobHistory />
        </CardContent>
      </Card>
    </div>
  );
}
