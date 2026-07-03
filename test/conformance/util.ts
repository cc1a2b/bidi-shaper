import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BC } from '../../src/bidi/types';
import { BIDI_CLASS_NAMES } from '../../src/data/generated/bidi-classes';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(HERE, 'data');

/** Read and gunzip a committed conformance fixture. */
export function loadGz(name: string): string {
  return gunzipSync(readFileSync(join(DATA_DIR, name))).toString('utf8');
}

/** Map a Bidi_Class token (e.g. "AL") to its numeric code. */
const NAME_TO_BC = new Map<string, number>(
  BIDI_CLASS_NAMES.map((n, i) => [n, i]),
);

export function bidiClassFromName(name: string): number {
  const v = NAME_TO_BC.get(name);
  if (v === undefined) throw new Error(`unknown Bidi_Class token "${name}"`);
  return v;
}

// Re-export so harness files don't need their own import path.
export { BC };
