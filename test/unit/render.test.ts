/**
 * Public string API: render / analyze / shape / reorder / getEmbeddingLevels /
 * detectDirection — pipeline behaviour, options, and index maps.
 */
import { describe, expect, it } from 'vitest';
import {
  analyze,
  detectDirection,
  getEmbeddingLevels,
  render,
  reorder,
  shape,
  UNICODE_VERSION,
} from '../../src/index';

describe('render', () => {
  it('returns plain LTR text unchanged (fast path, same reference)', () => {
    const s = 'hello (123) world!';
    expect(render(s)).toBe(s);
  });

  it('reverses an RTL-only string', () => {
    expect(render('سلام')).toBe('ﻡﻼﺳ');
  });

  it('handles mixed LTR/RTL text', () => {
    expect(render('abc سلام xyz')).toBe('abc ﻡﻼﺳ xyz');
  });

  it('mirrors brackets on RTL runs (L4)', () => {
    expect(render('(سلام)')).toBe('(ﻡﻼﺳ)');
  });

  it('mirroring can be disabled', () => {
    expect(render('(سلام)', { mirror: false })).toBe(')ﻡﻼﺳ(');
  });

  it('keeps number runs left-to-right inside RTL text', () => {
    expect(render('شماره 123')).toBe('123 ﻩﺭﺎﻤﺷ');
  });

  it('shapes Arabic before reordering', () => {
    // mim.init, reh.fina, hah.init, beh.medi, alef.fina — then reversed
    expect(render('مرحبا')).toBe('ﺎﺒﺣﺮﻣ');
  });

  it('shaping can be disabled', () => {
    expect(render('مرحبا', { shape: false })).toBe('ابحرم');
  });

  it('forces base direction', () => {
    expect(render('abc!', { direction: 'rtl' })).toBe('!abc');
    expect(render('abc!', { direction: 'ltr' })).toBe('abc!');
  });

  it('reorders each paragraph separately by default', () => {
    expect(render('سلام\nabc')).toBe('ﻡﻼﺳ\nabc');
  });

  it('paragraphs: single treats the whole text as one paragraph', () => {
    expect(render('a\nb', { direction: 'rtl', paragraphs: 'single' })).toBe('b\na');
  });

  it('drops explicit formatting characters removed by X9', () => {
    expect(render('a\u202bپ\u202cb')).toBe('aﭖb'); // RLE…PDF
  });

  it('is surrogate-safe', () => {
    expect(render('پ🙂ت')).toBe('ﺕ🙂ﭖ');
  });

  it('handles empty input', () => {
    expect(render('')).toBe('');
  });
});

describe('analyze', () => {
  it('reports direction and exact visual<->logical maps', () => {
    const a = analyze('پa');
    expect(a.direction).toBe('rtl');
    expect(a.text).toBe('aﭖ');
    expect(Array.from(a.levels)).toEqual([1, 2]);
    expect(a.visualToLogical).toEqual([1, 0]);
    expect(Array.from(a.logicalToVisual)).toEqual([1, 0]);
  });

  it('maps a lam-alef ligature back to the lam, alef to -1', () => {
    const a = analyze('لا');
    expect(a.text).toBe('ﻻ');
    expect(a.direction).toBe('rtl');
    expect(a.visualToLogical).toEqual([0]);
    expect(Array.from(a.logicalToVisual)).toEqual([0, -1]);
    expect(Array.from(a.levels)).toEqual([1, 1]);
  });

  it('marks stripped tashkeel as removed but keeps its level', () => {
    const a = analyze('مُد', { tashkeel: 'strip' });
    expect(a.logicalToVisual[1]).toBe(-1);
    expect(a.levels[1]).toBe(1);
  });

  it('marks X9-removed controls as removed', () => {
    const a = analyze('a\u202bپ\u202cb');
    expect(a.text).toBe('aﭖb');
    expect(Array.from(a.logicalToVisual)).toEqual([0, -1, 1, -1, 2]);
    expect(a.visualToLogical).toEqual([0, 2, 4]);
  });

  it('ASCII fast path returns identity maps and zero levels', () => {
    const a = analyze('ab c');
    expect(a.text).toBe('ab c');
    expect(a.direction).toBe('ltr');
    expect(Array.from(a.levels)).toEqual([0, 0, 0, 0]);
    expect(a.visualToLogical).toEqual([0, 1, 2, 3]);
    expect(Array.from(a.logicalToVisual)).toEqual([0, 1, 2, 3]);
  });

  it('resolves direction for forced and neutral cases', () => {
    expect(analyze('abc').direction).toBe('ltr');
    expect(analyze('abc', { direction: 'rtl' }).direction).toBe('rtl');
    expect(analyze('', { direction: 'rtl' }).direction).toBe('rtl');
    expect(analyze('123').direction).toBe('ltr'); // P3: no strong char -> LTR
  });
});

describe('shape (string level)', () => {
  it('shapes without reordering', () => {
    expect(shape('السلام')).toBe('ﺍﻟﺴﻼﻡ');
  });
});

describe('reorder', () => {
  it('reorders without shaping', () => {
    expect(reorder('مرحبا')).toBe('ابحرم');
  });

  it('still mirrors unless disabled', () => {
    expect(reorder('(سلام)')).toBe('(مالس)');
    expect(reorder('(سلام)', { mirror: false })).toBe(')مالس(');
  });
});

describe('getEmbeddingLevels', () => {
  it('returns per-code-point levels', () => {
    expect(Array.from(getEmbeddingLevels('aپ'))).toEqual([0, 1]);
    expect(Array.from(getEmbeddingLevels('پa'))).toEqual([1, 2]);
    expect(Array.from(getEmbeddingLevels('abc', { direction: 'rtl' }))).toEqual([2, 2, 2]);
  });

  it('ASCII fast path matches the full algorithm', () => {
    // 'پ' forces the slow path; slicing it off afterwards compares the same text.
    const ascii = 'abc 123, $45.00 (x+y)! \tdone\nnext';
    const fast = getEmbeddingLevels(ascii);
    const slow = getEmbeddingLevels(ascii + 'پ').slice(0, -1);
    expect(Array.from(fast)).toEqual(Array.from(slow));
    expect(fast.every((l) => l === 0)).toBe(true);
  });
});

describe('detectDirection', () => {
  it('finds the first strong direction', () => {
    expect(detectDirection('hello')).toBe('ltr');
    expect(detectDirection('سلام')).toBe('rtl');
    expect(detectDirection('مرحبا')).toBe('rtl');
    expect(detectDirection('123 !?')).toBe('neutral');
    expect(detectDirection('')).toBe('neutral');
  });

  it('skips isolated runs (P2)', () => {
    // FSI ... PDI followed by Persian: the isolate content is skipped
    expect(detectDirection('\u2068abc\u2069سلام')).toBe('rtl');
  });
});

describe('UNICODE_VERSION', () => {
  it('is a semantic version string', () => {
    expect(UNICODE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
