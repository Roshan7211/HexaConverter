/** Response shapes shared by the route handlers and the browser clients. */

export interface ApiError {
  error: string;
  code: string;
  fields?: Record<string, string>;
}

export interface UploadedFile {
  name: string;
  size: number;
  sourceFormat: string;
  category: string;
}

export interface TargetOption {
  id: string;
  label: string;
  category?: string;
}

export interface UploadResponse {
  /** Signed ticket exchanged for a conversion job. */
  ticket: string;
  file: UploadedFile;
  targets: TargetOption[];
}

export interface LimitsResponse {
  maxFileBytes: number;
  maxBatchFiles: number;
  retentionHours: number;
  concurrentJobs: number;
  usage: { used: number; limit: number };
}

export interface FormatsResponse {
  categories: readonly string[];
  formats: Array<{
    id: string;
    label: string;
    mime: string;
    category: string;
    canInput: boolean;
    canOutput: boolean;
  }>;
  routes: Array<{ from: string; to: string; available: boolean }>;
  counts: { formats: number; routes: number; available: number };
}
