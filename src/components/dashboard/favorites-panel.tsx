'use client';

import { useState } from 'react';

import Link from 'next/link';

import { ArrowRight, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import useSWR from 'swr';

import {
  addFavorite,
  getFavorites,
  removeFavorite,
  type FavoritesResponse,
} from '@/api/client/dashboard.client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatRelativeTime } from '@/utils';

/**
 * Pinned conversion routes.
 *
 * Suggestions come from the user's own completed conversions, so the panel is
 * useful on day two rather than only after someone curates it by hand.
 */
export function FavoritesPanel({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, mutate } = useSWR<FavoritesResponse>(
    'favorites',
    getFavorites,
    { revalidateOnFocus: false },
  );

  async function pin(from: string, to: string) {
    setBusy(`${from}>${to}`);
    try {
      await addFavorite(from, to);
      await mutate();
      toast.success(`Pinned ${from.toUpperCase()} to ${to.toUpperCase()}.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not pin that.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function unpin(from: string, to: string) {
    setBusy(`${from}>${to}`);
    try {
      await removeFavorite(from, to);
      await mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not unpin that.',
      );
    } finally {
      setBusy(null);
    }
  }

  const favorites = data?.favorites ?? [];
  const suggestions = data?.suggestions ?? [];
  const shown = compact ? favorites.slice(0, 6) : favorites;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="size-4 text-primary" aria-hidden="true" />
            Favorites
          </CardTitle>
          <CardDescription>
            One-click shortcuts to the conversions you repeat.
          </CardDescription>
        </div>
        {compact && favorites.length > 6 ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/favorites">View all</Link>
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : shown.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing pinned yet. Pin a conversion below to keep it one click
            away.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {shown.map((favorite) => (
              <li
                key={favorite.id}
                className="group flex items-center gap-2 rounded-xl border bg-card p-2.5 transition-colors hover:border-primary/40"
              >
                <Link
                  href={`/tools/${favorite.slug}`}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="truncate font-mono text-xs font-medium uppercase">
                    {favorite.sourceFormat}
                    <ArrowRight
                      className="mx-1 inline size-3 align-[-1px] text-muted-foreground"
                      aria-hidden="true"
                    />
                    {favorite.targetFormat}
                  </span>
                  {favorite.useCount > 0 ? (
                    <span className="tabular ml-auto shrink-0 text-[11px] text-muted-foreground">
                      {favorite.useCount}×
                      {favorite.lastUsedAt
                        ? ` · ${formatRelativeTime(favorite.lastUsedAt)}`
                        : ''}
                    </span>
                  ) : null}
                </Link>

                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                  disabled={
                    busy === `${favorite.sourceFormat}>${favorite.targetFormat}`
                  }
                  onClick={() =>
                    void unpin(favorite.sourceFormat, favorite.targetFormat)
                  }
                  aria-label={`Unpin ${favorite.sourceFormat} to ${favorite.targetFormat}`}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {suggestions.length > 0 ? (
          <div
            className={cn(
              'border-t pt-4',
              shown.length === 0 && 'border-t-0 pt-0',
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Suggested from your history
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      busy ===
                      `${suggestion.sourceFormat}>${suggestion.targetFormat}`
                    }
                    onClick={() =>
                      void pin(suggestion.sourceFormat, suggestion.targetFormat)
                    }
                  >
                    <Plus aria-hidden="true" />
                    <span className="font-mono text-xs uppercase">
                      {suggestion.sourceFormat} to {suggestion.targetFormat}
                    </span>
                    <span className="tabular text-[11px] text-muted-foreground">
                      {suggestion.useCount}×
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
