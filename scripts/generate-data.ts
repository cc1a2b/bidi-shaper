/**
 * scripts/generate-data.ts
 *
 * Generates the committed, range-compressed Unicode data tables that drive the
 * BiDi algorithm and Arabic shaper. Everything here is derived from the official
 * Unicode Character Database — nothing is hand-typed.
 *
 * Re-runnable & deterministic: pass --offline to force use of the cached source
 * files in scripts/.cache (downloaded on first run). Output goes to
 * src/data/generated/. Run with: npm run generate-data
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const UNICODE_VERSION = '17.0.0';
const UCD_BASE = `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd`;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CACHE_DIR = join(HERE, '.cache');
const OUT_DIR = join(ROOT, 'src', 'data', 'generated');

/** Source files: cache filename -> remote path (relative to UCD_BASE). */
const SOURCES: Record<string, string> = {
  'UnicodeData.txt': 'UnicodeData.txt',
  'DerivedBidiClass.txt': 'extracted/DerivedBidiClass.txt',
  'BidiBrackets.txt': 'BidiBrackets.txt',
  'BidiMirroring.txt': 'BidiMirroring.txt',
  'ArabicShaping.txt': 'ArabicShaping.txt',
};

const MAX_CP = 0x110000;

// ---------------------------------------------------------------------------
// Bidi_Class enumeration (stable across Unicode versions). Order is canonical
// and is mirrored in src/bidi/types.ts (a unit test asserts they match).
// ---------------------------------------------------------------------------
const BIDI_CLASS_NAMES = [
  'L', 'R', 'AL', 'EN', 'ES', 'ET', 'AN', 'CS', 'NSM', 'BN', 'B', 'S', 'WS',
  'ON', 'LRE', 'LRO', 'RLE', 'RLO', 'PDF', 'LRI', 'RLI', 'FSI', 'PDI',
] as const;
const BIDI_INDEX = new Map<string, number>(BIDI_CLASS_NAMES.map((n, i) => [n, i]));
const L_INDEX = 0;

/** Long Bidi_Class names (used by @missing lines) -> short codes. */
const BIDI_LONG_TO_SHORT: Record<string, string> = {
  Left_To_Right: 'L',
  Right_To_Left: 'R',
  Arabic_Letter: 'AL',
  European_Number: 'EN',
  European_Separator: 'ES',
  European_Terminator: 'ET',
  Arabic_Number: 'AN',
  Common_Separator: 'CS',
  Nonspacing_Mark: 'NSM',
  Boundary_Neutral: 'BN',
  Paragraph_Separator: 'B',
  Segment_Separator: 'S',
  White_Space: 'WS',
  Other_Neutral: 'ON',
  Left_To_Right_Embedding: 'LRE',
  Left_To_Right_Override: 'LRO',
  Right_To_Left_Embedding: 'RLE',
  Right_To_Left_Override: 'RLO',
  Pop_Directional_Format: 'PDF',
  Left_To_Right_Isolate: 'LRI',
  Right_To_Left_Isolate: 'RLI',
  First_Strong_Isolate: 'FSI',
  Pop_Directional_Isolate: 'PDI',
};

const JOINING_TYPE_NAMES = ['U', 'C', 'D', 'L', 'R', 'T'] as const;
const JOINING_INDEX = new Map<string, number>(JOINING_TYPE_NAMES.map((n, i) => [n, i]));
const U_INDEX = 0;

// ---------------------------------------------------------------------------
// IO helpers
// ---------------------------------------------------------------------------
async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadSource(name: string, offline: boolean): Promise<string> {
  const cached = join(CACHE_DIR, name);
  if (await exists(cached)) {
    return readFile(cached, 'utf8');
  }
  if (offline) {
    throw new Error(`--offline set but ${name} is not cached at ${cached}`);
  }
  const url = `${UCD_BASE}/${SOURCES[name]}`;
  process.stdout.write(`  downloading ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const text = await res.text();
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cached, text, 'utf8');
  return text;
}

/** Strip a trailing `# comment` and surrounding whitespace. */
function stripComment(line: string): string {
  const hash = line.indexOf('#');
  return (hash >= 0 ? line.slice(0, hash) : line).trim();
}

/** Parse "XXXX" or "XXXX..YYYY" into [start, end]. */
function parseRange(token: string): [number, number] {
  const t = token.trim();
  const dots = t.indexOf('..');
  if (dots >= 0) {
    return [parseInt(t.slice(0, dots), 16), parseInt(t.slice(dots + 2), 16)];
  }
  const cp = parseInt(t, 16);
  return [cp, cp];
}

// ---------------------------------------------------------------------------
// Range coalescing: turn a per-code-point Uint8Array into [start,end,value]
// triples, skipping cells equal to `skipValue` (the table default).
// ---------------------------------------------------------------------------
function coalesce(arr: Uint8Array, skipValue: number): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < arr.length) {
    const v = arr[i]!;
    if (v === skipValue) {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < arr.length && arr[j] === v) j++;
    out.push(i, j - 1, v);
    i = j;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------
function buildBidiClasses(derived: string): { triples: number[] } {
  const cls = new Uint8Array(MAX_CP).fill(L_INDEX);

  // 1) @missing defaults (in file order; later overrides earlier).
  for (const raw of derived.split('\n')) {
    const m = /^#\s*@missing:\s*([0-9A-Fa-f]+)\.\.([0-9A-Fa-f]+)\s*;\s*(\w+)/.exec(raw);
    if (!m) continue;
    const start = parseInt(m[1]!, 16);
    const end = parseInt(m[2]!, 16);
    const short = BIDI_LONG_TO_SHORT[m[3]!];
    if (short === undefined) throw new Error(`unknown @missing class ${m[3]}`);
    const idx = BIDI_INDEX.get(short)!;
    for (let cp = start; cp <= end && cp < MAX_CP; cp++) cls[cp] = idx;
  }

  // 2) Explicit assigned values (override defaults).
  for (const raw of derived.split('\n')) {
    const line = stripComment(raw);
    if (!line) continue;
    const [rangeTok, nameTok] = line.split(';');
    if (!rangeTok || !nameTok) continue;
    const idx = BIDI_INDEX.get(nameTok.trim());
    if (idx === undefined) throw new Error(`unknown bidi class "${nameTok.trim()}"`);
    const [start, end] = parseRange(rangeTok);
    for (let cp = start; cp <= end && cp < MAX_CP; cp++) cls[cp] = idx;
  }

  return { triples: coalesce(cls, L_INDEX) };
}

function buildMirroring(text: string): number[] {
  const pairs: Array<[number, number]> = [];
  for (const raw of text.split('\n')) {
    const line = stripComment(raw);
    if (!line) continue;
    const [a, b] = line.split(';');
    if (!a || !b) continue;
    pairs.push([parseInt(a.trim(), 16), parseInt(b.trim(), 16)]);
  }
  pairs.sort((x, y) => x[0] - y[0]);
  return pairs.flat();
}

interface BracketTables {
  cps: number[];
  pairs: number[];
  types: number[]; // 0 = open, 1 = close
  canonical: number[]; // flat [from, to, ...]
}

function buildBrackets(text: string, canonicalSingletons: Map<number, number>): BracketTables {
  const rows: Array<{ cp: number; pair: number; type: number }> = [];
  for (const raw of text.split('\n')) {
    const line = stripComment(raw);
    if (!line) continue;
    const [cpTok, pairTok, typeTok] = line.split(';');
    if (!cpTok || !pairTok || !typeTok) continue;
    rows.push({
      cp: parseInt(cpTok.trim(), 16),
      pair: parseInt(pairTok.trim(), 16),
      type: typeTok.trim() === 'o' ? 0 : 1,
    });
  }
  rows.sort((a, b) => a.cp - b.cp);

  // Canonical equivalence for BD16 matching: keep only mappings that touch a
  // bracket code point (e.g. U+2329->U+3008, U+232A->U+3009).
  const bracketSet = new Set(rows.map((r) => r.cp));
  const canonical: number[] = [];
  for (const [from, to] of [...canonicalSingletons.entries()].sort((a, b) => a[0] - b[0])) {
    if (bracketSet.has(from) || bracketSet.has(to)) canonical.push(from, to);
  }

  return {
    cps: rows.map((r) => r.cp),
    pairs: rows.map((r) => r.pair),
    types: rows.map((r) => r.type),
    canonical,
  };
}

interface UnicodeDataResult {
  transparent: Uint8Array; // GC in {Mn, Me, Cf}
  canonicalSingletons: Map<number, number>;
  shapingForms: Map<number, [number, number, number, number]>; // base -> [iso, init, med, fin]
  lamAlef: Map<number, [number, number]>; // alef -> [iso lig, final lig]
}

function buildFromUnicodeData(text: string): UnicodeDataResult {
  const transparent = new Uint8Array(MAX_CP);
  const canonicalSingletons = new Map<number, number>();
  const shapingForms = new Map<number, [number, number, number, number]>();
  const lamAlef = new Map<number, [number, number]>();
  const LAM = 0x0644;
  // Only the four MANDATORY lam-alef ligatures (alef, alef-madda, alef-hamza
  // above/below). Other lam-X ligatures in Forms-A are optional/cosmetic and
  // must not be applied automatically by a presentation-form shaper.
  const ALEF_VARIANTS = new Set([0x0622, 0x0623, 0x0625, 0x0627]);
  const FORM_TAGS: Record<string, number> = {
    '<isolated>': 0,
    '<initial>': 1,
    '<medial>': 2,
    '<final>': 3,
  };

  let rangeStart = -1;
  let rangeGc = '';

  for (const raw of text.split('\n')) {
    if (!raw) continue;
    const f = raw.split(';');
    if (f.length < 6) continue;
    const cp = parseInt(f[0]!, 16);
    const name = f[1]!;
    const gc = f[2]!;
    const decomp = f[5]!;

    // Handle "First>/<Last" range pairs for general-category coverage.
    if (name.endsWith(', First>')) {
      rangeStart = cp;
      rangeGc = gc;
      continue;
    }
    if (name.endsWith(', Last>')) {
      if (gc === 'Mn' || gc === 'Me' || gc === 'Cf' || rangeGc === 'Mn' || rangeGc === 'Me' || rangeGc === 'Cf') {
        for (let c = rangeStart; c <= cp && c < MAX_CP; c++) transparent[c] = 1;
      }
      rangeStart = -1;
      continue;
    }

    if (gc === 'Mn' || gc === 'Me' || gc === 'Cf') transparent[cp] = 1;

    if (decomp) {
      const parts = decomp.trim().split(/\s+/);
      const tag = parts[0]!;
      const formIdx = FORM_TAGS[tag];
      if (formIdx !== undefined) {
        const bases = parts.slice(1).map((h) => parseInt(h, 16));
        if (bases.length === 1) {
          const base = bases[0]!;
          let entry = shapingForms.get(base);
          if (!entry) {
            entry = [0, 0, 0, 0];
            shapingForms.set(base, entry);
          }
          // Prefer Presentation Forms-B (FE70..FEFF) on conflict.
          const existing = entry[formIdx];
          if (existing === 0 || (cp >= 0xfe70 && cp <= 0xfeff)) entry[formIdx] = cp;
        } else if (bases.length === 2 && bases[0] === LAM && ALEF_VARIANTS.has(bases[1]!)) {
          // lam-alef ligature; only isolated (0) and final (3) forms exist.
          const alef = bases[1]!;
          let entry = lamAlef.get(alef);
          if (!entry) {
            entry = [0, 0];
            lamAlef.set(alef, entry);
          }
          if (formIdx === 0) entry[0] = cp;
          else if (formIdx === 3) entry[1] = cp;
        }
      } else if (!tag.startsWith('<')) {
        // Canonical decomposition. Record singletons (single target) for BD16.
        const targets = parts.map((h) => parseInt(h, 16));
        if (targets.length === 1) canonicalSingletons.set(cp, targets[0]!);
      }
    }
  }

  return { transparent, canonicalSingletons, shapingForms, lamAlef };
}

interface JoiningTables {
  typeTriples: number[];
  groupNames: string[];
  groupTriples: number[];
}

function buildJoining(arabicShaping: string, transparent: Uint8Array): JoiningTables {
  const jt = new Uint8Array(MAX_CP).fill(U_INDEX);
  // Default T for transparent (Mn/Me/Cf) code points.
  for (let cp = 0; cp < MAX_CP; cp++) {
    if (transparent[cp]) jt[cp] = JOINING_INDEX.get('T')!;
  }

  const groupNameList = ['No_Joining_Group'];
  const groupNameIndex = new Map<string, number>([['No_Joining_Group', 0]]);
  const jg = new Uint8Array(MAX_CP); // 0 = No_Joining_Group

  for (const raw of arabicShaping.split('\n')) {
    const line = stripComment(raw);
    if (!line) continue;
    const f = line.split(';');
    if (f.length < 4) continue;
    const cp = parseInt(f[0]!.trim(), 16);
    const type = f[2]!.trim();
    const group = f[3]!.trim();
    const tIdx = JOINING_INDEX.get(type);
    if (tIdx === undefined) throw new Error(`unknown joining type "${type}"`);
    jt[cp] = tIdx;
    if (group !== 'No_Joining_Group') {
      let gIdx = groupNameIndex.get(group);
      if (gIdx === undefined) {
        gIdx = groupNameList.length;
        groupNameList.push(group);
        groupNameIndex.set(group, gIdx);
      }
      if (gIdx > 255) throw new Error('joining group index overflow (>255)');
      jg[cp] = gIdx;
    }
  }

  return {
    typeTriples: coalesce(jt, U_INDEX),
    groupNames: groupNameList,
    groupTriples: coalesce(jg, 0),
  };
}

// ---------------------------------------------------------------------------
// Emit helpers
// ---------------------------------------------------------------------------
function header(extra = ''): string {
  return (
    `// AUTO-GENERATED from the Unicode Character Database ${UNICODE_VERSION}.\n` +
    `// Source: ${UCD_BASE}\n` +
    `// Regenerate with: npm run generate-data\n` +
    `// DO NOT EDIT BY HAND.\n` +
    (extra ? extra + '\n' : '')
  );
}

/** Emit a long flat number[] without one-number-per-line bloat. */
function emitNumberArray(name: string, data: readonly number[]): string {
  const body = data.join(',');
  return `export const ${name}: readonly number[] = [${body}];\n`;
}

async function main(): Promise<void> {
  const offline = process.argv.includes('--offline');
  process.stdout.write(`bidi-shaper: generating Unicode ${UNICODE_VERSION} data tables\n`);

  const [unicodeData, derivedBidi, bidiBrackets, bidiMirroring, arabicShaping] = await Promise.all([
    loadSource('UnicodeData.txt', offline),
    loadSource('DerivedBidiClass.txt', offline),
    loadSource('BidiBrackets.txt', offline),
    loadSource('BidiMirroring.txt', offline),
    loadSource('ArabicShaping.txt', offline),
  ]);

  await mkdir(OUT_DIR, { recursive: true });

  // --- version.ts ---
  await writeFile(
    join(OUT_DIR, 'version.ts'),
    header() + `export const UNICODE_VERSION = '${UNICODE_VERSION}';\n`,
    'utf8',
  );

  // --- bidi-classes.ts ---
  const { triples: bidiTriples } = buildBidiClasses(derivedBidi);
  const bidiNames = BIDI_CLASS_NAMES.map((n) => `'${n}'`).join(', ');
  await writeFile(
    join(OUT_DIR, 'bidi-classes.ts'),
    header(`// ${bidiTriples.length / 3} non-L ranges (default class is L).`) +
      `export const BIDI_CLASS_NAMES = [${bidiNames}] as const;\n` +
      `export type BidiClassName = (typeof BIDI_CLASS_NAMES)[number];\n` +
      `/** Flat [start, end, classIndex] triples, sorted by start. Default class: L (0). */\n` +
      emitNumberArray('BIDI_CLASS_RANGES', bidiTriples),
    'utf8',
  );
  process.stdout.write(`  bidi-classes.ts: ${bidiTriples.length / 3} ranges\n`);

  // --- UnicodeData-derived tables ---
  const ud = buildFromUnicodeData(unicodeData);

  // --- mirroring.ts ---
  const mirrorPairs = buildMirroring(bidiMirroring);
  await writeFile(
    join(OUT_DIR, 'mirroring.ts'),
    header(`// ${mirrorPairs.length / 2} mirrored pairs.`) +
      `/** Flat [from, to] pairs, sorted by 'from'. */\n` +
      emitNumberArray('MIRROR_PAIRS', mirrorPairs),
    'utf8',
  );
  process.stdout.write(`  mirroring.ts: ${mirrorPairs.length / 2} pairs\n`);

  // --- brackets.ts ---
  const br = buildBrackets(bidiBrackets, ud.canonicalSingletons);
  await writeFile(
    join(OUT_DIR, 'brackets.ts'),
    header(`// ${br.cps.length} paired brackets.`) +
      `/** Bracket code points, sorted ascending. */\n` +
      emitNumberArray('BRACKET_CPS', br.cps) +
      `/** Paired (opposite) bracket for each entry in BRACKET_CPS. */\n` +
      emitNumberArray('BRACKET_PAIRS', br.pairs) +
      `/** 0 = opening (Bidi_Paired_Bracket_Type=Open), 1 = closing. */\n` +
      emitNumberArray('BRACKET_TYPES', br.types) +
      `/** Canonical-equivalence singletons among brackets: flat [from, to] pairs. */\n` +
      emitNumberArray('BRACKET_CANONICAL', br.canonical),
    'utf8',
  );
  process.stdout.write(`  brackets.ts: ${br.cps.length} brackets, ${br.canonical.length / 2} canonical\n`);

  // --- joining-types.ts ---
  const jn = buildJoining(arabicShaping, ud.transparent);
  const jtNames = JOINING_TYPE_NAMES.map((n) => `'${n}'`).join(', ');
  const jgNames = jn.groupNames.map((n) => `'${n}'`).join(', ');
  await writeFile(
    join(OUT_DIR, 'joining-types.ts'),
    header(`// ${jn.typeTriples.length / 3} non-U joining-type ranges.`) +
      `export const JOINING_TYPE_NAMES = [${jtNames}] as const;\n` +
      `export type JoiningTypeName = (typeof JOINING_TYPE_NAMES)[number];\n` +
      `export const JOINING_GROUP_NAMES = [${jgNames}] as const;\n` +
      `export type JoiningGroupName = (typeof JOINING_GROUP_NAMES)[number];\n` +
      `/** Flat [start, end, typeIndex] triples. Default joining type: U (0). */\n` +
      emitNumberArray('JOINING_TYPE_RANGES', jn.typeTriples) +
      `/** Flat [start, end, groupIndex] triples. Default group: No_Joining_Group (0). */\n` +
      emitNumberArray('JOINING_GROUP_RANGES', jn.groupTriples),
    'utf8',
  );
  process.stdout.write(
    `  joining-types.ts: ${jn.typeTriples.length / 3} type ranges, ${jn.groupNames.length} groups\n`,
  );

  // --- shaping-forms.ts ---
  const formKeys = [...ud.shapingForms.keys()].sort((a, b) => a - b);
  const formEntries = formKeys
    .map((k) => {
      const v = ud.shapingForms.get(k)!;
      return `  ${k}: [${v[0]}, ${v[1]}, ${v[2]}, ${v[3]}],`;
    })
    .join('\n');
  const lamKeys = [...ud.lamAlef.keys()].sort((a, b) => a - b);
  const lamEntries = lamKeys
    .map((k) => {
      const v = ud.lamAlef.get(k)!;
      return `  ${k}: [${v[0]}, ${v[1]}],`;
    })
    .join('\n');
  await writeFile(
    join(OUT_DIR, 'shaping-forms.ts'),
    header(`// ${formKeys.length} shaped letters, ${lamKeys.length} lam-alef ligatures.`) +
      `/** base code point -> [isolated, initial, medial, final] (0 = no such form). */\n` +
      `export const SHAPING_FORMS: Readonly<Record<number, readonly [number, number, number, number]>> = {\n${formEntries}\n};\n\n` +
      `/** alef variant code point -> [isolated ligature, final ligature]. */\n` +
      `export const LAM_ALEF: Readonly<Record<number, readonly [number, number]>> = {\n${lamEntries}\n};\n`,
    'utf8',
  );
  process.stdout.write(
    `  shaping-forms.ts: ${formKeys.length} letters, ${lamKeys.length} lam-alef ligatures\n`,
  );

  process.stdout.write('done.\n');
}

main().catch((err) => {
  process.stderr.write(String(err?.stack ?? err) + '\n');
  process.exit(1);
});
