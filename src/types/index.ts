/**
 * Shared type surface.
 *
 * Types live here when more than one layer needs them. Types used by exactly
 * one module stay next to that module.
 */

export type {
  ApiError,
  FormatsResponse,
  LimitsResponse,
  TargetOption,
  UploadedFile,
  UploadResponse,
} from '@/types/api';

export type {
  ArchiveOptions,
  Category,
  ConversionContext,
  ConversionEngine,
  ConversionOptions,
  ConversionOutcome,
  ConversionRoute,
  DocumentOptions,
  FormatSpec,
  ImageOptions,
  MediaOptions,
  Requirement,
  ResizeFit,
} from '@/types/conversion';

export type {
  CategoryPoint,
  DailyPoint,
  DashboardStats,
  ExpiringFile,
  StatsSummary,
  StorageUsage,
} from '@/types/stats';

export type { PutOptions, StorageDriver } from '@/types/storage';
