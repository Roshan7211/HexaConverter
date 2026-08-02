/**
 * PM2 process definition, for deploying to a VPS without Docker.
 *
 *   npm ci && npm run build
 *   npx prisma migrate deploy
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save && pm2 startup
 *
 * The web tier and the conversion worker are separate PM2 apps running the same
 * build, exactly as they are separate services under Docker. They differ only
 * in `WORKER_ENABLED`, and separating them means a video encode saturating a
 * core cannot delay request handling, and `pm2 reload web` during a deploy does
 * not kill a conversion halfway through.
 *
 * `.cjs` because package.json has no `"type": "module"` but the repo's ESLint
 * config treats bare `.js` at the root as ESM; the extension removes the
 * ambiguity for PM2's loader.
 */

// `output: 'standalone'` in next.config.mjs emits a self-contained server here.
// `next start` does not work with that setting — it prints a warning and is the
// wrong entry point. This is the supported one.
const SERVER = '.next/standalone/server.js';

module.exports = {
  apps: [
    {
      name: 'hexaconverter-web',
      script: SERVER,
      // Cluster mode load-balances across cores. Every instance is stateless:
      // sessions are JWTs and uploads go to object storage, so any instance can
      // serve any request.
      exec_mode: 'cluster',
      // One process per core by default. On a small box that is the wrong
      // trade: each instance costs 150-300 MB, and the memory is worth more to
      // a LibreOffice conversion than to a second request handler. Set
      // WEB_INSTANCES=1 on anything under ~4 GB.
      instances: process.env.WEB_INSTANCES || 'max',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '127.0.0.1',
        // Conversions belong to the worker app below — except on a host too
        // small to justify two Node processes, where running one that both
        // serves and converts is the better use of the memory. Set
        // WEB_WORKER_ENABLED=true and start only this app; the worker then
        // starts on the first conversion, with no scheduler and no queue
        // latency.
        //
        // Anything set here beats `.env`: PM2 puts this into the environment
        // before Next loads that file, and Next does not overwrite a variable
        // that is already set. So this must be the override point.
        WORKER_ENABLED:
          process.env.WEB_WORKER_ENABLED === 'true' ? 'true' : 'false',
      },
      // Next reads .env itself; this is only for values PM2 must see first.
      max_memory_restart: process.env.WEB_MAX_MEMORY || '1G',
      kill_timeout: 10000,
      listen_timeout: 10000,
      wait_ready: false,
      autorestart: true,
      // A process that dies repeatedly on boot is misconfigured, not unlucky.
      // Stop restarting so the failure is visible in `pm2 status`.
      max_restarts: 10,
      min_uptime: '30s',
      merge_logs: true,
      time: true,
    },

    {
      name: 'hexaconverter-worker',
      script: SERVER,
      // Fork, not cluster. The worker's own concurrency is set by
      // WORKER_CONCURRENCY; running N cluster instances would multiply it by N
      // and oversubscribe the CPU that ffmpeg and LibreOffice need.
      exec_mode: 'fork',
      instances: 1,
      env_production: {
        NODE_ENV: 'production',
        // A distinct port: the worker still boots the HTTP server, and two
        // processes cannot bind 3000. Nothing routes traffic here; it exists so
        // /api/health can be probed on this instance too.
        PORT: 3001,
        HOSTNAME: '127.0.0.1',
        WORKER_ENABLED: 'true',
        // WORKER_CONCURRENCY is deliberately absent. PM2 sets this object into
        // the environment before Next loads `.env`, and Next does not overwrite
        // a variable that is already set — so naming it here would silently
        // beat the value in `.env` and make that file a lie. Set it in `.env`,
        // at or below the core count: each slot can spawn an ffmpeg or soffice
        // child that saturates a core.
      },
      // LibreOffice and ffmpeg dominate this figure, not Node's heap. It must
      // sit below the host's real memory or the kernel's OOM killer gets there
      // first, which kills an arbitrary process instead of restarting this one.
      max_memory_restart: process.env.WORKER_MAX_MEMORY || '3G',
      // Long enough for an in-flight conversion to finish rather than be
      // killed mid-encode, leaving a half-written object in storage.
      kill_timeout: 30000,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      merge_logs: true,
      time: true,
    },
  ],
};
