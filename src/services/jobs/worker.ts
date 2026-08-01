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
 * conversion is actually queued.
 *
 * ---------------------------------------------------------------------------
 * That laziness has a consequence worth stating plainly, because it is not
 * obvious and it presents as a hung queue rather than an error.
 *
 * `ensureWorker()` is reached only from the job-creation paths. Those run in
 * whichever process served the request. So the loop starts **in the process
 * that accepted the job** — which is correct for a single process serving
 * traffic and converting, and wrong for a split deployment.
 *
 * Split across a web tier (`WORKER_ENABLED=false`) and a worker process
 * (`WORKER_ENABLED=true`), nothing ever starts it: job creation happens in the
 * web tier, where this is a deliberate no-op, and the worker process serves no
 * traffic, so no request reaches it. Jobs stay QUEUED forever and the only
 * symptom is a progress bar that never moves.
 *
 * A split deployment must therefore **schedule `/api/cron/process`**, which
 * calls `processQueueBatch()` directly and does not depend on this function.
 * That is required, not an optimisation. A single process with
 * `WORKER_ENABLED=true` needs no scheduler and starts conversions instantly.
 * ---------------------------------------------------------------------------
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
