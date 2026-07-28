import 'server-only';

import {
  JobStatus,
  type ArchiveOperation,
  type DocumentOperation,
  type FileCategory,
  type Prisma,
} from '@prisma/client';

import { prisma } from '@/database/client';

/**
 * Data access for conversion jobs.
 *
 * Every query in the application that touches `ConversionJob` goes through this
 * module: the ownership filter is applied here, so no caller can accidentally
 * read another user's row, and the selected columns are declared once.
 */

export const jobSelect = {
  id: true,
  status: true,
  category: true,
  sourceFormat: true,
  targetFormat: true,
  progress: true,
  error: true,
  inputName: true,
  inputSize: true,
  outputName: true,
  outputSize: true,
  outputKey: true,
  outputDetail: true,
  durationMs: true,
  createdAt: true,
  finishedAt: true,
  expiresAt: true,
  operation: true,
} satisfies Prisma.ConversionJobSelect;

export type JobRow = Prisma.ConversionJobGetPayload<{
  select: typeof jobSelect;
}>;

/** Scopes a query to a single owner — a user id or an anonymous guest id. */
export interface OwnerScope {
  userId: string | null;
  guestId: string | null;
}

export function ownerFilter(owner: OwnerScope): Prisma.ConversionJobWhereInput {
  return owner.userId ? { userId: owner.userId } : { guestId: owner.guestId! };
}

export function findOwned(id: string, owner: OwnerScope) {
  return prisma.conversionJob.findFirst({
    where: { id, ...ownerFilter(owner) },
    select: jobSelect,
  });
}

export function findKeys(id: string) {
  return prisma.conversionJob.findUnique({
    where: { id },
    select: { inputKey: true, outputKey: true },
  });
}

export function findForDownload(id: string) {
  return prisma.conversionJob.findUnique({
    where: { id },
    select: {
      status: true,
      outputKey: true,
      outputDetail: true,
      outputName: true,
      outputMime: true,
      outputSize: true,
      expiresAt: true,
    },
  });
}

export interface ListParams {
  owner: OwnerScope;
  where?: Prisma.ConversionJobWhereInput;
  limit: number;
  cursor?: string;
}

export function list({ owner, where, limit, cursor }: ListParams) {
  return prisma.conversionJob.findMany({
    where: { ...ownerFilter(owner), ...where },
    select: jobSelect,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

export function countForOwner(
  owner: OwnerScope,
  where: Prisma.ConversionJobWhereInput = {},
) {
  return prisma.conversionJob.count({
    where: { ...ownerFilter(owner), ...where },
  });
}

export function sumInputBytes(owner: OwnerScope) {
  return prisma.conversionJob.aggregate({
    where: { ...ownerFilter(owner), status: JobStatus.COMPLETED },
    _sum: { inputSize: true },
  });
}

export interface CreateJobData {
  owner: OwnerScope;
  category: FileCategory;
  sourceFormat: string;
  targetFormat: string;
  options: Prisma.InputJsonObject;
  inputKey: string;
  inputName: string;
  inputSize: number;
  inputMime: string;
  expiresAt: Date;
  ipHash: string;
  /** Set for toolkit jobs; null means a plain format conversion. */
  operation?: DocumentOperation;
  archiveOperation?: ArchiveOperation;
  /** Storage keys of any additional inputs, in user-chosen order. */
  extraInputKeys?: string[];
  extraInputNames?: string[];
}

export function create(data: CreateJobData) {
  return prisma.conversionJob.create({
    data: {
      userId: data.owner.userId,
      guestId: data.owner.guestId,
      status: JobStatus.QUEUED,
      category: data.category,
      sourceFormat: data.sourceFormat,
      targetFormat: data.targetFormat,
      options: data.options,
      inputKey: data.inputKey,
      inputName: data.inputName,
      inputSize: BigInt(data.inputSize),
      inputMime: data.inputMime,
      expiresAt: data.expiresAt,
      ipHash: data.ipHash,
      operation: data.operation ?? null,
      archiveOperation: data.archiveOperation ?? null,
      extraInputKeys: data.extraInputKeys ?? [],
      extraInputNames: data.extraInputNames ?? [],
    },
    select: jobSelect,
  });
}

export function markCancelled(id: string) {
  return prisma.conversionJob.update({
    where: { id },
    data: {
      status: JobStatus.CANCELLED,
      finishedAt: new Date(),
      error: 'Cancelled at your request.',
    },
    select: jobSelect,
  });
}

export function remove(id: string) {
  return prisma.conversionJob.delete({ where: { id } });
}

/**
 * Every stored object belonging to an owner, for the "delete my files" purge.
 * Running jobs are excluded: their worker still holds the input open.
 */
export function findPurgeableKeys(owner: OwnerScope) {
  return prisma.conversionJob.findMany({
    where: { ...ownerFilter(owner), status: { not: JobStatus.PROCESSING } },
    select: { id: true, inputKey: true, outputKey: true },
  });
}

export function removeMany(ids: string[]) {
  return prisma.conversionJob.deleteMany({ where: { id: { in: ids } } });
}
