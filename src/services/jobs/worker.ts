import 'server-only';

import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  claimNextJob,
  processJob,
  reclaimStaleJobs,
  WORKER_ID,
} from '@/services/jobs/queue.service';

/**
 * In-process background worker.
 *
 * Started lazily on first use so a cold instance does no work until a
 * conversion is actually queued. Deployments that cannot keep a loop alive set
 * `WORKER_ENABLED=false` and schedule `/api/cron/process` instead.
 */

/** Idle poll interval when the queue is empty. */
const IDLE_POLL_MS = 2_000;

/** Probability of an opportunistic lease sweep on an idle tick. */
const RECLAIM_CHANCE = 0.05;

interface WorkerState {
  running: boolean;
  active: number;
  stop: boolean;
}

// Cached on globalThis so a hot reload does not start a second set of loops.
const globalForWorker = globalThis as unknown as {
  hexaWorker: WorkerState | undefined;
};

function workerState(): WorkerState {
  globalForWorker.hexaWorker ??= { running: false, active: 0, stop: false };
  return globalForWorker.hexaWorker;
}

/** Starts the worker once per process. Safe to call from every request. */
export function ensureWorker(): void {
  const env = serverEnv();
  if (!env.WORKER_ENABLED) return;

  const state = workerState();
  if (state.running) return;

  state.running = true;
  state.stop = false;

  logger.info('Starting conversion worker', {
    workerId: WORKER_ID,
    concurrency: env.WORKER_CONCURRENCY,
  });

  for (let slot = 0; slot < env.WORKER_CONCURRENCY; slot += 1) {
    void workerLoop(state);
  }

  const shutdown = () => {
    state.stop = true;
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

async function workerLoop(state: WorkerState): Promise<void> {
  while (!state.stop) {
    try {
      const job = await claimNextJob();

      if (!job) {
        await sleep(IDLE_POLL_MS);
        // Periodically recover leases abandoned by a crashed instance.
        if (Math.random() < RECLAIM_CHANCE) await reclaimStaleJobs();
        continue;
      }

      state.active += 1;
      try {
        await processJob(job);
      } finally {
        state.active -= 1;
      }
    } catch (error) {
      logger.error('Worker loop error', { error });
      await sleep(5_000);
    }
  }

  state.running = false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
