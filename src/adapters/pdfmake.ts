/**
 * pdfmake adapter (`bidi-shaper/pdfmake`).
 *
 * Walks a pdfmake document definition and shapes/reorders every text node,
 * returning a new definition (the input is never mutated). Container shapes
 * handled: strings, `text` (string or array), `content`, `stack`, `columns`,
 * `ul` / `ol`, and `table.body` cells. Functions (header/footer callbacks)
 * and non-text nodes (images, canvases, QR) pass through untouched.
 */
import { detectDirection, render, type RenderOptions } from '../api/render';

export interface PdfmakeShaperOptions extends RenderOptions {
  /**
   * When true, text nodes whose content is RTL and that don't already set
   * `alignment` get `alignment: 'right'`. Default false.
   */
  rtlAlignment?: boolean;
}

const CHILD_KEYS = ['text', 'content', 'stack', 'columns', 'ul', 'ol'] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function processNode(node: unknown, options: PdfmakeShaperOptions | undefined): unknown {
  if (typeof node === 'string') return render(node, options);
  if (Array.isArray(node)) return node.map((child) => processNode(child, options));
  if (!isRecord(node) || typeof node === 'function') return node;

  const out: Record<string, unknown> = { ...node };

  if (options?.rtlAlignment && typeof node['text'] === 'string' && out['alignment'] === undefined) {
    if (detectDirection(node['text']) === 'rtl') out['alignment'] = 'right';
  }

  for (const key of CHILD_KEYS) {
    if (out[key] !== undefined) out[key] = processNode(out[key], options);
  }

  const table = out['table'];
  if (isRecord(table) && Array.isArray(table['body'])) {
    out['table'] = {
      ...table,
      body: table['body'].map((row: unknown) =>
        Array.isArray(row) ? row.map((cell) => processNode(cell, options)) : row,
      ),
    };
  }

  return out;
}

/** Shape/reorder a single pdfmake content node (string, array, or object). */
export function shapeContent<T>(node: T, options?: PdfmakeShaperOptions): T {
  return processNode(node, options) as T;
}

/**
 * Shape/reorder a whole document definition's `content`, `header`, and
 * `footer` (function headers/footers are left for you to wrap yourself).
 *
 *   pdfMake.createPdf(shapeDocDefinition(docDefinition)).download();
 */
export function shapeDocDefinition<T extends Record<string, unknown>>(
  docDefinition: T,
  options?: PdfmakeShaperOptions,
): T {
  const out: Record<string, unknown> = { ...docDefinition };
  for (const key of ['content', 'header', 'footer'] as const) {
    if (out[key] !== undefined && typeof out[key] !== 'function') {
      out[key] = processNode(out[key], options);
    }
  }
  return out as T;
}
