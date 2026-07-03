/**
 * Adapter behaviour against mock hosts: jsPDF event hook, pdfmake document
 * walking, canvas drawing/alignment, three.js line preparation.
 */
import { describe, expect, it } from 'vitest';
import { installJsPdfShaper, rtlText, type JsPdfStaticApi } from '../../src/adapters/jspdf';
import { shapeContent, shapeDocDefinition } from '../../src/adapters/pdfmake';
import {
  fillTextBidi,
  measureTextBidi,
  prepareCanvasText,
  strokeTextBidi,
  type MinimalCanvasContext,
} from '../../src/adapters/canvas';
import { prepareLines, prepareText } from '../../src/adapters/three';
import { textBidi, rtlText as pdfkitRtlText, type PdfKitTextOptions } from '../../src/adapters/pdfkit';
import { render } from '../../src/index';

const SALAM_VISUAL = 'ﻡﻼﺳ';

describe('jspdf adapter', () => {
  it('rtlText processes strings and string arrays', () => {
    expect(rtlText('سلام')).toBe(SALAM_VISUAL);
    expect(rtlText(['سلام', 'abc'])).toEqual([SALAM_VISUAL, 'abc']);
  });

  it('installJsPdfShaper registers a preProcessText hook that rewrites payloads', () => {
    const api: JsPdfStaticApi = { events: [] };
    installJsPdfShaper(api);
    expect(api.events).toHaveLength(1);
    const [event, handler] = api.events[0]!;
    expect(event).toBe('preProcessText');

    const payload = { text: 'سلام' as string | string[] };
    handler(payload);
    expect(payload.text).toBe(SALAM_VISUAL);

    const arrayPayload = { text: ['سلام', 'مرحبا'] as string | string[] };
    handler(arrayPayload);
    expect(arrayPayload.text).toEqual([SALAM_VISUAL, render('مرحبا')]);
  });
});

describe('pdfmake adapter', () => {
  it('processes strings, arrays, and nested containers without mutating input', () => {
    const def = {
      pageSize: 'A4',
      content: [
        'سلام',
        { text: 'مرحبا', fontSize: 14 },
        { stack: ['سلام'] },
        { columns: [{ text: 'سلام' }, 'abc'] },
        { ul: ['سلام'] },
        { table: { widths: ['*'], body: [['سلام', { text: 'abc' }]] } },
      ],
    };
    const frozen = JSON.stringify(def);
    const out = shapeDocDefinition(def);

    expect(JSON.stringify(def)).toBe(frozen); // input untouched
    expect(out.pageSize).toBe('A4');
    const content = out.content as unknown[];
    expect(content[0]).toBe(SALAM_VISUAL);
    expect((content[1] as { text: string; fontSize: number })).toEqual({
      text: render('مرحبا'),
      fontSize: 14,
    });
    expect((content[2] as { stack: string[] }).stack).toEqual([SALAM_VISUAL]);
    expect((content[3] as { columns: unknown[] }).columns).toEqual([
      { text: SALAM_VISUAL },
      'abc',
    ]);
    expect((content[4] as { ul: string[] }).ul).toEqual([SALAM_VISUAL]);
    expect((content[5] as { table: { widths: string[]; body: unknown[][] } }).table).toEqual({
      widths: ['*'],
      body: [[SALAM_VISUAL, { text: 'abc' }]],
    });
  });

  it('leaves function header/footer untouched and processes string ones', () => {
    const footer = (): string => 'page';
    const out = shapeDocDefinition({ content: 'abc', header: 'سلام', footer });
    expect(out.header).toBe(SALAM_VISUAL);
    expect(out.footer).toBe(footer);
  });

  it('rtlAlignment sets alignment: right on RTL text nodes only', () => {
    const out = shapeContent(
      [{ text: 'سلام' }, { text: 'abc' }, { text: 'سلام', alignment: 'center' }],
      { rtlAlignment: true },
    );
    expect(out).toEqual([
      { text: SALAM_VISUAL, alignment: 'right' },
      { text: 'abc' },
      { text: SALAM_VISUAL, alignment: 'center' },
    ]);
  });
});

interface DrawCall {
  method: string;
  text: string;
  x: number;
  y: number;
}

function mockCtx(font?: string): { ctx: MinimalCanvasContext; calls: DrawCall[] } {
  const calls: DrawCall[] = [];
  const ctx: MinimalCanvasContext = {
    font,
    textAlign: 'start',
    fillText: (text, x, y) => void calls.push({ method: 'fill', text, x, y }),
    strokeText: (text, x, y) => void calls.push({ method: 'stroke', text, x, y }),
    measureText: (text) => ({ width: text.length * 10 }),
  };
  return { ctx, calls };
}

describe('canvas adapter', () => {
  it('draws processed text and restores textAlign', () => {
    const { ctx, calls } = mockCtx('20px sans-serif');
    fillTextBidi(ctx, 'سلام', 5, 10);
    expect(calls).toEqual([{ method: 'fill', text: SALAM_VISUAL, x: 5, y: 10 }]);
    expect(ctx.textAlign).toBe('start');
  });

  it('lays out multiple lines using the font size', () => {
    const { ctx, calls } = mockCtx('20px sans-serif');
    fillTextBidi(ctx, 'سلام\nabc', 0, 100);
    expect(calls.map((c) => [c.text, c.y])).toEqual([
      [SALAM_VISUAL, 100],
      ['abc', 125], // 20px * 1.25
    ]);
  });

  it('honours an explicit lineHeight and start/end alignment per line direction', () => {
    const { ctx, calls } = mockCtx();
    const aligns: string[] = [];
    const recordingCtx: MinimalCanvasContext = {
      ...ctx,
      fillText: (text, x, y) => {
        aligns.push(recordingCtx.textAlign);
        ctx.fillText(text, x, y);
      },
    };
    fillTextBidi(recordingCtx, 'سلام\nabc', 0, 0, { align: 'start', lineHeight: 30 });
    expect(calls.map((c) => c.y)).toEqual([0, 30]);
    expect(aligns).toEqual(['right', 'left']); // RTL line anchors right, LTR line left
  });

  it('strokes through the same pipeline', () => {
    const { ctx, calls } = mockCtx();
    strokeTextBidi(ctx, 'سلام', 1, 2);
    expect(calls).toEqual([{ method: 'stroke', text: SALAM_VISUAL, x: 1, y: 2 }]);
  });

  it('measures the processed text', () => {
    const { ctx } = mockCtx();
    // 'سلام' shapes to a 3-glyph visual (lam-alef ligature), so 3 × 10
    expect(measureTextBidi(ctx, 'سلام')).toEqual({ width: 30 });
  });

  it('prepareCanvasText exposes per-line direction', () => {
    expect(prepareCanvasText('سلام\nabc')).toEqual([
      { text: SALAM_VISUAL, direction: 'rtl' },
      { text: 'abc', direction: 'ltr' },
    ]);
  });
});

describe('pdfkit adapter', () => {
  interface TextCall {
    text: string;
    x?: number | PdfKitTextOptions;
    y?: number;
    options?: PdfKitTextOptions;
  }

  interface MockDoc {
    text(text: string, x?: number | PdfKitTextOptions, y?: number, options?: PdfKitTextOptions): unknown;
  }

  function mockDoc(): { doc: MockDoc; calls: TextCall[] } {
    const calls: TextCall[] = [];
    const doc: MockDoc = {
      text(text, x, y, options) {
        calls.push({ text, x, y, options });
        return doc;
      },
    };
    return { doc, calls };
  }

  it('processes text and disables fontkit features in the 4-arg form', () => {
    const { doc, calls } = mockDoc();
    const ret = textBidi(doc, 'سلام', 72, 80, { align: 'right' });
    expect(ret).toBe(doc);
    expect(calls).toEqual([
      { text: SALAM_VISUAL, x: 72, y: 80, options: { align: 'right', features: [] } },
    ]);
  });

  it('keeps options in second position for the (text, options) overload', () => {
    const { doc, calls } = mockDoc();
    textBidi(doc, 'سلام', { width: 200 });
    expect(calls).toEqual([
      { text: SALAM_VISUAL, x: { width: 200, features: [] }, y: undefined, options: undefined },
    ]);
  });

  it('respects user-provided features and forwards bidi options', () => {
    const { doc, calls } = mockDoc();
    textBidi(doc, 'abc!', 10, 20, { features: ['liga'], bidi: { direction: 'rtl' } });
    expect(calls).toEqual([
      { text: '!abc', x: 10, y: 20, options: { features: ['liga'] } },
    ]);
  });

  it('shapes Arabic by default (fontkit must not re-shape)', () => {
    const { doc, calls } = mockDoc();
    textBidi(doc, 'مرحبا');
    expect(calls[0]!.text).toBe(render('مرحبا'));
    expect(calls[0]!.options).toEqual({ features: [] });
  });

  it('exports a string-level helper', () => {
    expect(pdfkitRtlText('سلام')).toBe(SALAM_VISUAL);
  });
});

describe('three adapter', () => {
  it('prepares single-line labels', () => {
    expect(prepareText('سلام')).toBe(SALAM_VISUAL);
  });

  it('prepares multi-line labels with directions', () => {
    expect(prepareLines('سلام\nabc')).toEqual([
      { text: SALAM_VISUAL, direction: 'rtl' },
      { text: 'abc', direction: 'ltr' },
    ]);
  });
});
