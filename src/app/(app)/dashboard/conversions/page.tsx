import type { Metadata } from 'next';

import { JobHistory } from '@/components/dashboard/job-history';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Conversions',
  description: 'Every conversion you have run.',
  path: '/dashboard/conversions',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

export default function ConversionsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversion history</CardTitle>
          <CardDescription>
            Files are removed automatically when their retention window ends;
            the record of the conversion stays here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JobHistory />
        </CardContent>
      </Card>
    </div>
  );
}
