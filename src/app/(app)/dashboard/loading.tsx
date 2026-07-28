import { Skeleton } from '@/components/ui/skeleton';

/** Route-level loading skeleton shown while a server component streams in. */
export default function Loading() {
  return (
    <div className="container py-16">
      <span className="sr-only" role="status">
        Loading
      </span>
      <Skeleton className="h-10 w-2/3 max-w-lg" />
      <Skeleton className="mt-4 h-5 w-full max-w-2xl" />
      <Skeleton className="mt-2 h-5 w-3/4 max-w-xl" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
