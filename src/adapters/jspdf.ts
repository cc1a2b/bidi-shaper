/**
 * jsPDF adapter (`bidi-shaper/jspdf`).
 *
 * jsPDF draws text runs left-to-right with no shaping. Either process each
 * string yourself with {@link rtlText}, or call {@link installJsPdfShaper}
 * once so every doc.text() is processed automatically via jsPDF's
 * `preProcessText` plugin event.
 *
 * The output uses Arabic presentation forms (U+FB50–U+FEFF), which jsPDF's
 * built-in arabic parser does not touch — the two do not double-process.
 * Your embedded font must include those glyphs (most Arabic TTFs do).
 */
import { render, type RenderOptions } from '../api/render';

export type { RenderOptions };

/** A jsPDF `preProcessText` event payload (structurally typed — no jspdf dependency). */
export interface JsPdfTextPayload {
  text: string | string[];
}

/** The static jsPDF API object (`jsPDF.API`), as far as this adapter needs it. */
export interface JsPdfStaticApi {
  events: Array<[string, (payload: JsPdfTextPayload) => void]>;
}

/** Shape + reorder one string (or each string of an array) for doc.text(). */
export function rtlText(text: string, options?: RenderOptions): string;
export function rtlText(text: string[], options?: RenderOptions): string[];
export function rtlText(text: string | string[], options?: RenderOptions): string | string[] {
  return Array.isArray(text) ? text.map((t) => render(t, options)) : render(text, options);
}

/**
 * Register a `preProcessText` hook on `jsPDF.API` so every subsequent
 * doc.text() call is shaped and reordered transparently.
 *
 *   import { jsPDF } from 'jspdf';
 *   import { installJsPdfShaper } from 'bidi-shaper/jspdf';
 *   installJsPdfShaper(jsPDF.API);
 */
export function installJsPdfShaper(api: JsPdfStaticApi, options?: RenderOptions): void {
  api.events.push([
    'preProcessText',
    (payload: JsPdfTextPayload) => {
      payload.text = Array.isArray(payload.text)
        ? payload.text.map((t) => render(t, options))
        : render(payload.text, options);
    },
  ]);
}
