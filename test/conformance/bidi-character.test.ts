/**
 * Runs the official Unicode BidiCharacterTest.txt against the full pipeline
 * (real code points, including paired-bracket resolution N0).
 *
 * Line format:
 *   codepoints ; paraDirection ; resolvedParaLevel ; levels ; visualOrder
 *     paraDirection: 0 = LTR, 1 = RTL, 2 = auto
 *     levels:        space-separated, "x" for characters removed by X9
 *     visualOrder:   indices in visual order, excluding removed characters
 */
import { describe, expect, it } from 'vitest';
import { resolveParagraph } from '../../src/bidi/levels';
import { computeBaseLevel } from '../../src/bidi/levels';
import { applyL1, reorderIndices } from '../../src/bidi/reorder';
import { classify } from '../../src/bidi/algorithm';
import { loadGz } from './util';

interface Failure {
  line: number;
  kind: string;
  expected: string;
  actual: string;
  input: string;
}

describe('BidiCharacterTest.txt (UAX #9 conformance)', () => {
  it('matches resolved paragraph level, levels, and reorder for every case', () => {
    const text = loadGz('BidiCharacterTest.txt.gz');
    const lines = text.split('\n');
    const failures: Failure[] = [];
    let cases = 0;

    for (let ln = 0; ln < lines.length; ln++) {
      const raw = lines[ln]!;
      if (!raw || raw.startsWith('#')) continue;
      const fields = raw.split(';');
      if (fields.length < 5) continue;

      const codePoints = fields[0]!.trim().split(/\s+/).map((h) => parseInt(h, 16));
      const paraDir = parseInt(fields[1]!.trim(), 10);
      const expectedParaLevel = parseInt(fields[2]!.trim(), 10);
      const expectedLevels = fields[3]!.trim().split(/\s+/);
      const expectedOrder = fields[4]!.trim() === '' ? [] : fields[4]!.trim().split(/\s+/).map(Number);

      const types = classify(codePoints);
      const cps = Int32Array.from(codePoints);
      const paraLevel = paraDir === 0 ? 0 : paraDir === 1 ? 1 : computeBaseLevel(types, 0, types.length);

      cases++;

      if (paraLevel !== expectedParaLevel) {
        failures.push({
          line: ln + 1,
          kind: 'paraLevel',
          expected: String(expectedParaLevel),
          actual: String(paraLevel),
          input: fields[0]!.trim(),
        });
        continue;
      }

      const { levels, removed } = resolveParagraph(types, cps, paraLevel);
      applyL1(types, levels, removed, paraLevel);

      const actualLevels = Array.from(levels, (lv, i) => (removed[i] ? 'x' : String(lv)));
      if (actualLevels.join(' ') !== expectedLevels.join(' ')) {
        failures.push({
          line: ln + 1,
          kind: 'levels',
          expected: expectedLevels.join(' '),
          actual: actualLevels.join(' '),
          input: fields[0]!.trim(),
        });
        continue;
      }

      const order = reorderIndices(levels, removed);
      if (order.join(' ') !== expectedOrder.join(' ')) {
        failures.push({
          line: ln + 1,
          kind: 'order',
          expected: expectedOrder.join(' '),
          actual: order.join(' '),
          input: fields[0]!.trim(),
        });
      }
    }

    if (failures.length > 0) {
      const sample = failures
        .slice(0, 15)
        .map((f) => `  L${f.line} [${f.kind}] in="${f.input}"\n    exp: ${f.expected}\n    got: ${f.actual}`)
        .join('\n');
      throw new Error(`${failures.length}/${cases} BidiCharacterTest cases failed:\n${sample}`);
    }
    expect(cases).toBeGreaterThan(90_000);
  });
});
