import type { Metadata } from 'next';

import { FavoritesPanel } from '@/components/dashboard/favorites-panel';
import { QuickConvert } from '@/components/dashboard/quick-convert';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Favorites',
  description: 'Your pinned conversion shortcuts.',
  path: '/dashboard/favorites',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

export default function FavoritesPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.6fr_1fr]">
      <FavoritesPanel />
      <QuickConvert />
    </div>
  );
}
