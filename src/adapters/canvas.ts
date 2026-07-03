/**
 * Canvas 2D adapter (`bidi-shaper/canvas`).
 *
 * Browsers shape Arabic in fillText for you — this adapter is for canvas
 * implementations that don't: minimal/embedded 2D contexts, custom
 * rasterizers, bitmap-font engines, and game frameworks that draw glyph
 * runs naively left-to-right.
 *
 * Types are structural, so any object with fillText/strokeText/measureText
 * works (node-canvas, skia-canvas, OffscreenCanvas, mocks).
 */
import { analyze, render, type Direction, type RenderOptions } from '../api/render';

/** The slice of CanvasRenderingContext2D this adapter touches. */
export interface MinimalCanvasContext {
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  strokeText(text: string, x: number, y: number, maxWidth?: number): void;
  measureText(text: string): { width: number };
  textAlign: 'left' | 'right' | 'center' | 'start' | 'end';
  font?: string;
}

export interface CanvasTextOptions extends RenderOptions {
  /**
   * Logical alignment. 'start'/'end' resolve against each line's detected
   * direction ('start' = right edge for an RTL line). Default: the context's
   * current textAlign.
   */
  align?: 'left' | 'right' | 'center' | 'start' | 'end';
  /** Distance between baselines for multi-line text. Default: 1.25 × the px size parsed from ctx.font. */
  lineHeight?: number;
}

/** One processed line, ready to draw. */
export interface PreparedCanvasLine {
  /** Visual-order, shaped text. */
  text: string;
  /** Resolved direction of the line. */
  direction: Direction;
}

/** Process text into visual-order lines plus each line's resolved direction. */
export function prepareCanvasText(text: string, options?: RenderOptions): PreparedCanvasLine[] {
  return text.split('\n').map((line) => {
    const a = analyze(line, options);
    return { text: a.text, direction: a.direction };
  });
}

function parseFontPx(font: string | undefined): number {
  const m = font === undefined ? null : /(\d+(?:\.\d+)?)px/.exec(font);
  return m === null ? 16 : parseFloat(m[1]!);
}

function resolveAlign(
  align: CanvasTextOptions['align'],
  direction: Direction,
): 'left' | 'right' | 'center' {
  if (align === 'center') return 'center';
  if (align === 'start') return direction === 'rtl' ? 'right' : 'left';
  if (align === 'end') return direction === 'rtl' ? 'left' : 'right';
  return align ?? 'left';
}

function drawLines(
  ctx: MinimalCanvasContext,
  method: 'fillText' | 'strokeText',
  text: string,
  x: number,
  y: number,
  options?: CanvasTextOptions,
): void {
  const lines = prepareCanvasText(text, options);
  const lineHeight = options?.lineHeight ?? parseFontPx(ctx.font) * 1.25;
  const savedAlign = ctx.textAlign;
  for (let i = 0; i < lines.length; i++) {
    ctx.textAlign = options?.align !== undefined ? resolveAlign(options.align, lines[i]!.direction) : savedAlign;
    ctx[method](lines[i]!.text, x, y + i * lineHeight);
  }
  ctx.textAlign = savedAlign;
}

/** Drop-in fillText: shapes, reorders, handles \n and start/end alignment. */
export function fillTextBidi(
  ctx: MinimalCanvasContext,
  text: string,
  x: number,
  y: number,
  options?: CanvasTextOptions,
): void {
  drawLines(ctx, 'fillText', text, x, y, options);
}

/** Drop-in strokeText counterpart of {@link fillTextBidi}. */
export function strokeTextBidi(
  ctx: MinimalCanvasContext,
  text: string,
  x: number,
  y: number,
  options?: CanvasTextOptions,
): void {
  drawLines(ctx, 'strokeText', text, x, y, options);
}

/** Measure the processed (shaped, visual-order) text — single line. */
export function measureTextBidi(
  ctx: MinimalCanvasContext,
  text: string,
  options?: RenderOptions,
): { width: number } {
  return ctx.measureText(render(text, options));
}
