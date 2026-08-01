import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { sourceFiles } from './helpers/source-files';

/**
 * Executable architecture rules.
 *
 * The layering described in `docs/ARCHITECTURE.md` is only real if something
 * enforces it. These tests read every source file's imports and fail the build
 * when a dependency points the wrong way — which is the moment the mistake is
 * cheapest to fix.
 *
 * Dependencies may only point downwards:
 *
 *   app -> components -> hooks -> api -> services -> database
 *                                   \-> middleware -/
 *                          all layers -> lib -> utils -> types
 */

const SRC = path.join(process.cwd(), 'src');

/** Local `@/` imports declared by a file. */
function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return Array.from(source.matchAll(/from\s+'(@\/[^']+)'/g)).map(
    (match) => match[1]!,
  );
}

function layerOf(file: string): string {
  return path
    .relative(SRC, file)
    .split(path.sep)[0]!
    .replace(/\.tsx?$/, '');
}

interface Rule {
  /** Layer the rule applies to. */
  layer: string;
  /** Import prefixes this layer must never reach for. */
  forbidden: string[];
  why: string;
  /** Files exempted, with the reason recorded inline. */
  allow?: string[];
}

const RULES: Rule[] = [
  {
    layer: 'utils',
    forbidden: [
      '@/services',
      '@/database',
      '@/app',
      '@/components',
      '@/api',
      '@/hooks',
      '@/lib',
    ],
    why: 'utils sits at the bottom of the graph and must stay dependency-free',
  },
  {
    layer: 'types',
    forbidden: [
      '@/services',
      '@/database',
      '@/app',
      '@/components',
      '@/hooks',
      '@/api',
      '@/lib',
    ],
    why: 'types must not depend on implementations',
  },
  {
    layer: 'lib',
    forbidden: ['@/services', '@/database', '@/app', '@/components', '@/hooks'],
    why: 'lib is cross-cutting infrastructure and must not know about domains',
  },
  {
    layer: 'database',
    forbidden: [
      '@/services',
      '@/app',
      '@/components',
      '@/hooks',
      '@/middleware',
    ],
    why: 'the data layer must not depend on the layers above it',
  },
  {
    layer: 'services',
    forbidden: ['@/app', '@/components', '@/hooks'],
    why: 'business logic must be usable without the web layer',
  },
  {
    layer: 'components',
    forbidden: ['@/database', '@/app'],
    why: 'components reach the server through api/ and services/, never the database',
  },
  {
    layer: 'hooks',
    forbidden: ['@/database', '@/app', '@/services/storage', '@/services/jobs'],
    why: 'hooks are browser code and must call the API layer, not server services',
  },
  {
    layer: 'app',
    forbidden: ['@/database/client'],
    why: 'route handlers and pages must use repositories or services, not raw Prisma',
  },
];

describe('layer boundaries', () => {
  for (const rule of RULES) {
    it(`${rule.layer}: ${rule.why}`, () => {
      const violations: string[] = [];

      for (const file of sourceFiles()) {
        if (layerOf(file) !== rule.layer) continue;

        const relative = path.relative(process.cwd(), file);
        if (rule.allow?.includes(relative)) continue;

        for (const specifier of importsOf(file)) {
          const breach = rule.forbidden.find(
            (prefix) =>
              specifier === prefix || specifier.startsWith(`${prefix}/`),
          );
          if (breach) violations.push(`${relative} imports ${specifier}`);
        }
      }

      expect(violations, violations.join('\n')).toEqual([]);
    });
  }
});

describe('module hygiene', () => {
  it('no module imports itself through the alias', () => {
    const violations: string[] = [];

    for (const file of sourceFiles()) {
      const self = `@/${path.relative(SRC, file).replace(/\.tsx?$/, '')}`;
      if (importsOf(file).includes(self)) {
        violations.push(path.relative(process.cwd(), file));
      }
    }

    expect(violations).toEqual([]);
  });

  it('every server-only module is marked as such', () => {
    // Modules that touch the database, object storage or child processes must
    // fail loudly if they are ever pulled into a client bundle.
    const mustBeGuarded = [
      'src/database/client.ts',
      'src/database/health.ts',
      'src/services/jobs/queue.service.ts',
      'src/services/jobs/worker.ts',
      'src/services/jobs/retention.service.ts',
      'src/services/jobs/job.service.ts',
      'src/services/identity/identity.service.ts',
      'src/services/upload/session.service.ts',
      'src/services/documents/pdf-toolkit.service.ts',
      'src/services/documents/pdf-to-docx.service.ts',
      'src/services/documents/document-task.service.ts',
    ];

    const unguarded = mustBeGuarded.filter(
      (file) =>
        !readFileSync(path.join(process.cwd(), file), 'utf8').includes(
          "import 'server-only'",
        ),
    );

    expect(unguarded).toEqual([]);
  });

  it('repositories are the only modules importing the Prisma client', () => {
    const allowed = new Set(['database/client.ts', 'database/health.ts']);
    const violations: string[] = [];

    for (const file of sourceFiles()) {
      const relative = path.relative(SRC, file);
      if (relative.startsWith('database')) continue;

      if (importsOf(file).includes('@/database/client')) {
        violations.push(relative);
      }
    }

    expect(violations.filter((file) => !allowed.has(file))).toEqual([]);
  });
});
