/**
 * Generated-table consistency: the numeric enums in src/bidi/types.ts MUST
 * stay aligned with the name arrays emitted by scripts/generate-data.ts
 * (types.ts promises this test exists).
 */
import { describe, expect, it } from 'vitest';
import { BC, JT } from '../../src/bidi/types';
import { BIDI_CLASS_NAMES } from '../../src/data/generated/bidi-classes';
import { JOINING_TYPE_NAMES } from '../../src/data/generated/joining-types';
import { getBidiClass, getJoiningType, getMirror } from '../../src/data/lookup';

describe('generated data consistency', () => {
  it('BC numeric codes match BIDI_CLASS_NAMES order', () => {
    expect(Object.keys(BC)).toHaveLength(BIDI_CLASS_NAMES.length);
    for (const [name, code] of Object.entries(BC)) {
      expect(BIDI_CLASS_NAMES[code]).toBe(name);
    }
  });

  it('JT numeric codes match JOINING_TYPE_NAMES order', () => {
    expect(Object.keys(JT)).toHaveLength(JOINING_TYPE_NAMES.length);
    for (const [name, code] of Object.entries(JT)) {
      expect(JOINING_TYPE_NAMES[code]).toBe(name);
    }
  });

  it('spot-checks well-known property values', () => {
    expect(getBidiClass(0x0041)).toBe(BC.L); // A
    expect(getBidiClass(0x07ca)).toBe(BC.R); // ߊ N'Ko A
    expect(getBidiClass(0x0628)).toBe(BC.AL); // ب
    expect(getBidiClass(0x0031)).toBe(BC.EN); // 1
    expect(getBidiClass(0x0661)).toBe(BC.AN); // ١
    expect(getBidiClass(0x200f)).toBe(BC.R); // RLM
    expect(getBidiClass(0x2067)).toBe(BC.RLI);

    expect(getJoiningType(0x0628)).toBe(JT.D); // ب
    expect(getJoiningType(0x0627)).toBe(JT.R); // ا
    expect(getJoiningType(0x0640)).toBe(JT.C); // tatweel
    expect(getJoiningType(0x064e)).toBe(JT.T); // fatha
    expect(getJoiningType(0x0041)).toBe(JT.U); // A

    expect(getMirror(0x0028)).toBe(0x0029); // ( -> )
    expect(getMirror(0x0029)).toBe(0x0028);
    expect(getMirror(0x0041)).toBe(0); // not mirrored
  });
});
