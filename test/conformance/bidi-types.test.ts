/**
 * Runs the official Unicode BidiTest.txt against the level resolver.
 *
 * The file enumerates Bidi_Class sequences (no concrete code points, no
 * paired brackets) and, for each, the expected resolved levels and visual
 * order under up to three paragraph directions encoded as a bitset:
 *   1 = auto (P2/P3), 2 = LTR, 4 = RTL
 *
 * Expected results are carried by the preceding @Levels / @Reorder lines.
 */
import { describe, expect, it } from 'vitest';
import { baseLevelForTypes, resolveByTypes } from '../../src/bidi/algorithm';
import { bidiClassFromName, loadGz } from './util';

interface Failure {
  line: number;
  bitset: number;
  kind: string;
  expected: string;
  actual: string;
  input: string;
}

describe('BidiTest.txt (UAX #9 conformance)', () => {
  it('matches expected levels and reorder for every case and direction', () => {
    const text = loadGz('BidiTest.txt.gz');
    const lines = text.split('\n');
    const failures: Failure[] = [];
    let cases = 0;

    let expectedLevels: string[] = [];
    let expectedOrder: number[] = [];

    for (let ln = 0; ln < lines.length; ln++) {
      const raw = lines[ln]!.trim();
      if (!raw || raw.startsWith('#')) continue;

      if (raw.startsWith('@Levels:')) {
        const body = raw.slice('@Levels:'.length).trim();
        expectedLevels = body === '' ? [] : body.split(/\s+/);
        continue;
      }
      if (raw.startsWith('@Reorder:')) {
        const body = raw.slice('@Reorder:'.length).trim();
        expectedOrder = body === '' ? [] : body.split(/\s+/).map(Number);
        continue;
      }
      if (raw.startsWith('@')) continue; // unknown directive — ignore per spec

      const semi = raw.indexOf(';');
      if (semi < 0) continue;
      const tokens = raw.slice(0, semi).trim().split(/\s+/);
      const bitset = parseInt(raw.slice(semi + 1).trim(), 10);
      const types = Uint8Array.from(tokens, (t) => bidiClassFromName(t));

      for (const [bit, dir] of [
        [1, 'auto'],
        [2, 'ltr'],
        [4, 'rtl'],
      ] as const) {
        if ((bitset & bit) === 0) continue;
        cases++;
        const paraLevel = dir === 'ltr' ? 0 : dir === 'rtl' ? 1 : baseLevelForTypes(types);
        const { levels, removed, order } = resolveByTypes(types, paraLevel);

        const actualLevels = Array.from(levels, (lv, i) => (removed[i] ? 'x' : String(lv)));
        if (actualLevels.join(' ') !== expectedLevels.join(' ')) {
          failures.push({
            line: ln + 1,
            bitset: bit,
            kind: 'levels',
            expected: expectedLevels.join(' '),
            actual: actualLevels.join(' '),
            input: tokens.join(' '),
          });
          continue;
        }
        if (order.join(' ') !== expectedOrder.join(' ')) {
          failures.push({
            line: ln + 1,
            bitset: bit,
            kind: 'order',
            expected: expectedOrder.join(' '),
            actual: order.join(' '),
            input: tokens.join(' '),
          });
        }
      }
    }

    if (failures.length > 0) {
      const sample = failures
        .slice(0, 15)
        .map(
          (f) =>
            `  L${f.line} [${f.kind} dir=${f.bitset}] in="${f.input}"\n    exp: ${f.expected}\n    got: ${f.actual}`,
        )
        .join('\n');
      throw new Error(`${failures.length}/${cases} BidiTest cases failed:\n${sample}`);
    }
    expect(cases).toBeGreaterThan(700_000);
  });
});
