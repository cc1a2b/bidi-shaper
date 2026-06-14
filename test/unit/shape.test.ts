/**
 * Arabic shaping engine: joining contexts, presentation forms, lam-alef
 * ligatures, ZWJ/ZWNJ/tatweel behaviour, tashkeel handling.
 *
 * Expected code points come straight from the Unicode presentation-form
 * blocks (U+FB50–U+FDFF, U+FE70–U+FEFF).
 */
import { describe, expect, it } from 'vitest';
import { shapeCodePoints, shapeString, isTashkeel } from '../../src/shape/shape';

const cps = (s: string): number[] => Array.from(s, (c) => c.codePointAt(0)!);

describe('shapeCodePoints', () => {
  it('shapes السلام with the mandatory lam-alef ligature', () => {
    // alef.isol, lam.init, seen.medi, lam-alef.fina, meem.isol
    expect(shapeCodePoints(cps('السلام')).codePoints).toEqual([
      0xfe8d, 0xfedf, 0xfeb4, 0xfefc, 0xfee1,
    ]);
  });

  it('shapes محمد through initial/medial/final forms', () => {
    // meem.init, hah.medi, meem.medi, dal.fina
    expect(shapeCodePoints(cps('محمد')).codePoints).toEqual([0xfee3, 0xfea4, 0xfee4, 0xfeaa]);
  });

  it('selects dual-joining forms from context', () => {
    // beh.init + beh.fina
    expect(shapeCodePoints(cps('بب')).codePoints).toEqual([0xfe91, 0xfe90]);
  });

  it('ZWNJ breaks joining', () => {
    const BEH = 0x0628;
    const ZWNJ = 0x200c;
    expect(shapeCodePoints([BEH, ZWNJ, BEH]).codePoints).toEqual([0xfe8f, ZWNJ, 0xfe8f]);
  });

  it('ZWJ forces joining', () => {
    const BEH = 0x0628;
    const ZWJ = 0x200d;
    expect(shapeCodePoints([BEH, ZWJ]).codePoints).toEqual([0xfe91, ZWJ]);
    expect(shapeCodePoints([ZWJ, BEH]).codePoints).toEqual([ZWJ, 0xfe90]);
  });

  it('tatweel (kashida) joins on both sides and passes through', () => {
    expect(shapeCodePoints(cps('بـب')).codePoints).toEqual([0xfe91, 0x0640, 0xfe90]);
  });

  it('combining marks are transparent to joining', () => {
    // beh + fatha + beh joins THROUGH the mark
    expect(shapeCodePoints(cps('بَب')).codePoints).toEqual([0xfe91, 0x064e, 0xfe90]);
  });

  it('tashkeel: strip removes harakat and keeps the src map consistent', () => {
    const r = shapeCodePoints(cps('بَب'), { tashkeel: 'strip' });
    expect(r.codePoints).toEqual([0xfe91, 0xfe90]);
    expect(r.src).toEqual([0, 2]);
  });

  it('forms the lam-alef ligature across intervening marks', () => {
    // lam + fatha + alef -> isolated ligature, mark re-attached after it
    const r = shapeCodePoints(cps('لَا'));
    expect(r.codePoints).toEqual([0xfefb, 0x064e]);
    expect(r.src).toEqual([0, 1]);
  });

  it('uses the final lam-alef ligature when the lam joins backward', () => {
    // seen.init + lam-alef.fina
    expect(shapeCodePoints(cps('سلا')).codePoints).toEqual([0xfeb3, 0xfefc]);
  });

  it('covers all four lam-alef variants', () => {
    expect(shapeCodePoints(cps('لآ')).codePoints).toEqual([0xfef5]);
    expect(shapeCodePoints(cps('لأ')).codePoints).toEqual([0xfef7]);
    expect(shapeCodePoints(cps('لإ')).codePoints).toEqual([0xfef9]);
    expect(shapeCodePoints(cps('لا')).codePoints).toEqual([0xfefb]);
  });

  it('ligatures can be disabled', () => {
    // lam.init + alef.fina instead of the ligature
    expect(shapeCodePoints(cps('لا'), { ligatures: false }).codePoints).toEqual([0xfedf, 0xfe8e]);
  });

  it('letters after a right-joining letter start a new join', () => {
    // dal never joins forward: dal.isol + beh.isol
    expect(shapeCodePoints(cps('دب')).codePoints).toEqual([0xfea9, 0xfe8f]);
  });

  it('shapes Persian letters (peh, gaf, farsi yeh)', () => {
    // پدر: peh.init, dal.fina, reh.isol
    expect(shapeCodePoints(cps('پدر')).codePoints).toEqual([64344, 65194, 65197]);
    // بیت: beh.init, farsi-yeh.medi, teh.fina
    expect(shapeCodePoints(cps('بیت')).codePoints).toEqual([0xfe91, 64511, 65174]);
    // گ initial before a joining letter
    expect(shapeCodePoints(cps('گل')).codePoints).toEqual([64404, 65246]);
  });

  it('shapes Urdu letters (kheh-doachashmee, alef, noon)', () => {
    // کھانا: kaf.init, heh-doachashmee.medi, alef.fina, noon.init, alef.fina
    expect(shapeCodePoints(cps('کھانا')).codePoints).toEqual([
      64400, 64429, 65166, 65255, 65166,
    ]);
    // ے yeh barree only joins backward: final after beh
    expect(shapeCodePoints(cps('بے')).codePoints).toEqual([0xfe91, 64431]);
  });

  it('degrades to the closest available form when Unicode lacks one', () => {
    // noon ghunna (ں) is dual-joining but has only isolated/final presentation
    // forms — a medial context falls back to the final form.
    const TATWEEL = 0x0640;
    expect(shapeCodePoints([TATWEEL, 0x06ba, TATWEEL]).codePoints).toEqual([
      TATWEEL, 64415, TATWEEL,
    ]);
  });

  it('non-Arabic text passes through untouched', () => {
    const latin = cps('hello (123)');
    expect(shapeCodePoints(latin).codePoints).toEqual(latin);
    const thaana = cps('ދިވެހި');
    expect(shapeCodePoints(thaana).codePoints).toEqual(thaana);
  });

  it('keeps src as an exact output->input map', () => {
    const r = shapeCodePoints(cps('السلام'));
    expect(r.src).toEqual([0, 1, 2, 3, 5]); // index 4 (alef) merged into the ligature at 3
  });
});

describe('shapeString', () => {
  it('round-trips through strings and handles astral characters', () => {
    expect(shapeString('بب')).toBe('ﺑﺐ');
    expect(shapeString('🙂بب')).toBe('🙂ﺑﺐ');
  });
});

describe('isTashkeel', () => {
  it('classifies harakat and Quranic marks', () => {
    for (const cp of [0x064b, 0x064e, 0x0652, 0x0670, 0x06d6, 0x0610]) {
      expect(isTashkeel(cp)).toBe(true);
    }
    for (const cp of [0x0628, 0x0644, 0x0020, 0x05d0]) {
      expect(isTashkeel(cp)).toBe(false);
    }
  });
});
