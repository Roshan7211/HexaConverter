import type { Category } from '@/types/conversion';

/**
 * Dashboard statistics contracts.
 *
 * These live in `types/` rather than beside the service because chart
 * components consume them: a client component must not reach into a
 * `server-only` module even for a type, or a careless refactor turns an erased
 * import into a runtime one.
 */

export interface DailyPoint {
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  completed: number;
  failed: number;
}

export interface CategoryPoint {
  category: Category;
  label: string;
  count: number;
}

export interface StatsSummary {
  total: number;
  completed: number;
  failed: number;
  active: number;
  /** 0–100, or null when nothing has finished yet. */
  successRate: number | null;
  avgDurationMs: number | null;
  bytesIn: number;
  bytesOut: number;
  /** Positive means the outputs are smaller than the inputs. */
  bytesSavedPercent: number | null;
}

export interface ExpiringFile {
  id: string;
  name: string;
  sizeBytes: number;
  expiresAt: string;
}

export interface StorageUsage {
  /** Bytes of converted output currently retained. */
  usedBytes: number;
  fileCount: number;
  /** Practical ceiling for the plan, used for the meter. */
  quotaBytes: number;
  percentUsed: number;
  retentionHours: number;
  expiring: ExpiringFile[];
}

export interface DashboardStats {
  summary: StatsSummary;
  daily: DailyPoint[];
  byCategory: CategoryPoint[];
  storage: StorageUsage;
}
