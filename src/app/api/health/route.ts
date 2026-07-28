import { NextResponse } from 'next/server';

import { databaseHealthy } from '@/database/health';
import { isRequirementAvailable } from '@/services/conversion/binaries';
import { storage } from '@/services/storage';
import { isScannerConfigured } from '@/services/upload/scanner.service';

/**
 * GET /api/health
 *
 * Readiness probe for load balancers and uptime monitors. Returns 503 when a
 * hard dependency is down so an unhealthy instance leaves rotation. Optional
 * tooling degrades specific routes rather than the whole service, so it is
 * reported but does not fail the check. The response contains no configuration.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Check = 'ok' | 'degraded' | 'down';

export async function GET() {
  const checks: Record<string, Check> = {};

  checks.database = (await databaseHealthy()) ? 'ok' : 'down';

  try {
    // A miss is a healthy answer; only a thrown error indicates a problem.
    await storage().exists('healthcheck/probe');
    checks.storage = 'ok';
  } catch {
    checks.storage = 'down';
  }

  checks.libreoffice = (await isRequirementAvailable('libreoffice'))
    ? 'ok'
    : 'degraded';
  checks.poppler = (await isRequirementAvailable('poppler'))
    ? 'ok'
    : 'degraded';

  // Reported as `degraded` rather than `ok` when absent: a monitor should be
  // able to tell "scanning is on" from "scanning was never configured".
  checks.malwareScanner = isScannerConfigured() ? 'ok' : 'degraded';

  const healthy = checks.database === 'ok' && checks.storage === 'ok';

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'unhealthy',
      checks,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
