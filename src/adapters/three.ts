/**
 * three.js adapter (`bidi-shaper/three`).
 *
 * TextGeometry, BitmapText implementations, and most SDF/MSDF text plugins
 * place glyphs in string order with no shaping. Feed them
 * {@link prepareText} output instead of the raw string.
 *
 * For multi-line labels use {@link prepareLines}: each line carries its
 * resolved direction so you can set the anchor/pivot per line
 * (e.g. troika-text `anchorX`, or aligning geometry bounding boxes).
 */
import { analyze, render, type Direction, type RenderOptions } from '../api/render';

export type { Direction, RenderOptions };

/** One display-ready line of a (possibly multi-line) label. */
export interface PreparedTextLine {
  /** Visual-order, shaped text — pass to TextGeometry/your text mesh. */
  text: string;
  /** Resolved direction; align RTL lines to the right edge of the label. */
  direction: Direction;
}

/** Shape + reorder a single-line label for TextGeometry and friends. */
export function prepareText(text: string, options?: RenderOptions): string {
  return render(text, options);
}

/** Shape + reorder each line of a multi-line label, with per-line direction. */
export function prepareLines(text: string, options?: RenderOptions): PreparedTextLine[] {
  return text.split('\n').map((line) => {
    const a = analyze(line, options);
    return { text: a.text, direction: a.direction };
  });
}
