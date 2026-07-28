import 'server-only';

import { JobStatus, Prisma } from '@prisma/client';

import { prisma } from '@/database/client';
import type { OwnerScope } from '@/database/repositories/job.repository';
import { ownerFilter } from '@/database/repositories/job.repository';

/**
 * Aggregate queries for the statistics dashboard.
 *
 * Grouping is pushed into PostgreSQL rather than pulled into Node: a user with
 * thousands of conversions still transfers only one row per bucket.
 */

export interface DailyCount {
  day: Date;
  completed: bigint;
  failed: bigint;
}

/**
 * Conversions per day for the trailing window. `generate_series` supplies the
 * zero rows, so the chart never has to infer a missing day.
 */
export function dailyCounts(owner: OwnerScope, days: number) {
  const ownerClause = owner.userId
    ? Prisma.sql`"userId" = ${owner.userId}`
    : Prisma.sql`"guestId" = ${owner.guestId}`;

  return prisma.$queryRaw<DailyCount[]>(Prisma.sql`
    SELECT
      series.day::date AS day,
      COALESCE(COUNT(job.id) FILTER (WHERE job.status = 'COMPLETED'), 0) AS completed,
      COALESCE(COUNT(job.id) FILTER (WHERE job.status = 'FAILED'), 0)    AS failed
    FROM generate_series(
      -- Prisma binds a JS number as bigint; make_interval only accepts int.
      date_trunc('day', NOW()) - MAKE_INTERVAL(days => ${days - 1}::int),
      date_trunc('day', NOW()),
      '1 day'
    ) AS series(day)
    LEFT JOIN "ConversionJob" AS job
      ON date_trunc('day', job."createdAt") = series.day
      AND ${ownerClause}
    GROUP BY series.day
    ORDER BY series.day ASC
  `);
}

export function countsByCategory(owner: OwnerScope) {
  return prisma.conversionJob.groupBy({
    by: ['category'],
    where: ownerFilter(owner),
    _count: { _all: true },
    orderBy: { _count: { category: 'desc' } },
  });
}

export function countsByStatus(owner: OwnerScope) {
  return prisma.conversionJob.groupBy({
    by: ['status'],
    where: ownerFilter(owner),
    _count: { _all: true },
  });
}

/** The routes this owner uses most, for the favourites suggestion list. */
export function topRoutes(owner: OwnerScope, limit: number) {
  return prisma.conversionJob.groupBy({
    by: ['sourceFormat', 'targetFormat'],
    where: { ...ownerFilter(owner), status: JobStatus.COMPLETED },
    _count: { _all: true },
    orderBy: { _count: { sourceFormat: 'desc' } },
    take: limit,
  });
}

export function durationAndBytes(owner: OwnerScope) {
  return prisma.conversionJob.aggregate({
    where: { ...ownerFilter(owner), status: JobStatus.COMPLETED },
    _avg: { durationMs: true },
    _sum: { inputSize: true, outputSize: true },
    _count: { _all: true },
  });
}

/**
 * Bytes currently occupying storage: only files that still exist, i.e.
 * completed conversions inside their retention window.
 */
export function liveStorage(owner: OwnerScope) {
  return prisma.conversionJob.aggregate({
    where: {
      ...ownerFilter(owner),
      status: JobStatus.COMPLETED,
      expiresAt: { gt: new Date() },
      outputKey: { not: null },
    },
    _sum: { outputSize: true },
    _count: { _all: true },
  });
}

/** Files due to be deleted soon, so the dashboard can warn before they go. */
export function expiringSoon(owner: OwnerScope, withinHours: number) {
  const cutoff = new Date(Date.now() + withinHours * 60 * 60 * 1000);

  return prisma.conversionJob.findMany({
    where: {
      ...ownerFilter(owner),
      status: JobStatus.COMPLETED,
      outputKey: { not: null },
      expiresAt: { gt: new Date(), lt: cutoff },
    },
    select: { id: true, outputName: true, outputSize: true, expiresAt: true },
    orderBy: { expiresAt: 'asc' },
    take: 5,
  });
}
