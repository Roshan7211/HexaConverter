import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = path.join(process.cwd(), 'src');

/** Every `.ts`/`.tsx` file under `src/`, resolved to absolute paths. */
export function sourceFiles(dir: string = SRC): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...sourceFiles(full));
      continue;
    }
    if (/\.tsx?$/.test(entry) && !entry.endsWith('.d.ts')) files.push(full);
  }

  return files;
}
