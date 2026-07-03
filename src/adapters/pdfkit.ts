/**
 * PDFKit adapter (`bidi-shaper/pdfkit`).
 *
 * PDFKit's font engine (fontkit) applies OpenType shaping but performs NO
 * BiDi reordering — Arabic comes out joined but in backwards order. Feeding
 * it reordered-but-unshaped text doesn't work either: fontkit would then
 * shape with a mirrored joining context.
 *
 * {@link textBidi} therefore does both passes here (visual order + explicit
 * presentation forms) and disables fontkit's own substitutions for the call
 * by passing `features: []`, unless you supply your own feature list.
 */
import { render, type RenderOptions } from '../api/render';

export type { RenderOptions };

/** PDFKit text options, as far as this adapter cares (everything else passes through). */
export interface PdfKitTextOptions {
  /** OpenType features for fontkit. Defaults to [] so pre-shaped text isn't re-shaped. */
  features?: string[];
  /** Options for the shaping/reordering pass (this adapter's own key). */
  bidi?: RenderOptions;
  [key: string]: unknown;
}

/** The slice of a PDFDocument this adapter touches (structurally typed). */
export interface PdfKitDocLike {
  text(
    text: string,
    xOrOptions?: number | PdfKitTextOptions,
    y?: number,
    options?: PdfKitTextOptions,
  ): unknown;
}

/** Shape + reorder one string for a manual doc.text() call. */
export function rtlText(text: string, options?: RenderOptions): string {
  return render(text, options);
}

/** Split our `bidi` key out and make sure fontkit substitutions are off. */
function prepareOptions(options: PdfKitTextOptions | undefined): {
  bidi: RenderOptions | undefined;
  rest: PdfKitTextOptions;
} {
  const { bidi, ...rest } = options ?? {};
  if (rest.features === undefined) rest.features = [];
  return { bidi, rest };
}

/**
 * Drop-in replacement for doc.text() that shapes and reorders first.
 *
 *   import PDFDocument from 'pdfkit';
 *   import { textBidi } from 'bidi-shaper/pdfkit';
 *
 *   textBidi(doc, 'مرحبا بالعالم', 72, 80, { align: 'right' });
 *   textBidi(doc, 'سلام', { align: 'right', bidi: { direction: 'rtl' } });
 *
 * Returns whatever doc.text() returns (the doc, for chaining).
 */
export function textBidi(
  doc: PdfKitDocLike,
  text: string,
  x?: number | PdfKitTextOptions,
  y?: number,
  options?: PdfKitTextOptions,
): unknown {
  if (typeof x === 'object' && x !== null) {
    // doc.text(text, options) overload — options must stay in second position:
    // PDFKit defaults an undefined x to {} and would discard a 4th argument.
    const { bidi, rest } = prepareOptions(x);
    return doc.text(render(text, bidi), rest);
  }
  const { bidi, rest } = prepareOptions(options);
  return doc.text(render(text, bidi), x, y, rest);
}
