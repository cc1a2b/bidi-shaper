# bidi-shaper

**Logical→visual Unicode BiDi (UAX #9) reordering + Arabic contextual shaping for renderers that draw text naively left-to-right** — PDF generators, canvas rasterizers, WebGL/three.js, terminals, game engines.

[![CI](https://github.com/cc1a2b/bidi-shaper/actions/workflows/ci.yml/badge.svg)](https://github.com/cc1a2b/bidi-shaper/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/bidi-shaper)](https://www.npmjs.com/package/bidi-shaper)
[![Unicode 17.0.0](https://img.shields.io/badge/Unicode-17.0.0-5d3fd3)](https://www.unicode.org/versions/Unicode17.0.0/)
[![conformance](https://img.shields.io/badge/UAX%20%239%20conformance-861%2C948%20cases-3fb950)](#conformance)
![zero dependencies](https://img.shields.io/badge/dependencies-0-3fb950)
[![license MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

```ts
import { render } from 'bidi-shaper';

doc.text(render('مرحبا بالعالم'), 40, 60); // jsPDF, but now the Arabic is readable
```

| | What your renderer draws |
|---|---|
| **Raw string** (logical order, unshaped) | `م ر ح ب ا  ب ا ل ع ا ل م` — backwards **and** disconnected |
| **`render()` output** (visual order, shaped) | `ﻢﻟﺎﻌﻟﺎﺑ ﺎﺒﺣﺮﻣ` — correct |

---

## The problem in 30 seconds

Browsers, iOS/Android text views, and HarfBuzz-based stacks run two invisible passes before any glyph hits the screen:

1. **The Unicode Bidirectional Algorithm (UAX #9)** — Arabic and other right-to-left scripts are *stored* in reading order ("logical order") but *drawn* right-to-left, with numbers and embedded Latin still flowing left-to-right. Something has to compute the final left-to-right glyph sequence ("visual order").
2. **Arabic contextual shaping** — Arabic letters are cursive: the same letter takes a different form when it starts, continues, or ends a word (ع ﻋ ﻌ ﻊ are all one letter). Fonts handle this through shaping engines.

Renderers that place glyphs one after another — **jsPDF, pdfmake, PDFKit-style generators, bitmap-font game engines, three.js TextGeometry, minimal canvas implementations, plotters, e-ink dashboards** — run neither pass. Arabic comes out as disconnected letters in the wrong direction; right-to-left words come out reversed; numbers inside RTL sentences land in the wrong place; brackets point the wrong way.

`bidi-shaper` runs both passes in pure TypeScript and hands you a plain string in final visual order. Draw it left-to-right, glyph by glyph, and it's right.

## Features

- ✅ **Full UAX #9 implementation** — explicit embeddings & overrides (X1–X10), isolates (LRI/RLI/FSI/PDI), weak types (W1–W7), bracket pairs (N0/BD16), neutrals (N1–N2), implicit levels (I1–I2), line rules (L1, L2, L4 mirroring)
- ✅ **Verified against both official Unicode test suites** — all **861,948** cases pass ([details](#conformance))
- ✅ **Arabic shaping** — joining classes per the Unicode core spec §9.2, presentation forms (U+FB50–U+FEFF), all four mandatory lam-alef ligatures, ZWJ/ZWNJ/tatweel aware, harakat-transparent
- ✅ **Index maps for hit-testing** — `analyze()` returns visual↔logical maps and per-character embedding levels (cursor placement, selection, link regions)
- ✅ **Adapters included** — `bidi-shaper/jspdf`, `bidi-shaper/pdfmake`, `bidi-shaper/pdfkit`, `bidi-shaper/canvas`, `bidi-shaper/three`
- ✅ **Zero dependencies**, ~15 kB gzipped including Unicode tables, tree-shakeable ESM + CJS, TypeScript types
- ✅ **Fast** — typed arrays, binary-search range tables, and an O(n) ASCII fast path that returns the input string untouched

## Install

```bash
npm install bidi-shaper
```

Node ≥ 18, or any modern browser/bundler. No native modules, no WASM, no fonts shipped.

## Quick start

```ts
import { render } from 'bidi-shaper';

render('مرحبا بالعالم');        // 'ﻢﻟﺎﻌﻟﺎﺑ ﺎﺒﺣﺮﻣ'  (shaped + reordered)
render('سلام دنیا');            // 'ﺎﯿﻧﺩ ﻡﻼﺳ'
render('قیمت: 123.45');         // '123.45 :ﺖﻤﯿﻗ'    (numbers stay LTR)
render('قائمة (أ)');            // brackets mirrored correctly
render('hello world');          // 'hello world'      (fast path: returned as-is)
```

Everything is configurable:

```ts
render(text, {
  direction: 'auto',     // 'auto' | 'ltr' | 'rtl' — base paragraph direction (default 'auto', P2/P3 first-strong)
  shape: true,           // Arabic presentation forms (default true)
  ligatures: true,       // lam-alef ligatures (default true)
  mirror: true,          // L4 bracket mirroring (default true)
  tashkeel: 'keep',      // 'keep' | 'strip' Arabic diacritics (default 'keep')
  paragraphs: 'split',   // 'split' | 'single' — reorder each \n-paragraph separately (default 'split')
});
```

## How it works

```
  logical-order string  (what you store: "مرحبا بالعالم")
          │
          ▼
  ┌─────────────────────────────────────────────────────────┐
  │ 1. Arabic shaping  (Unicode core spec §9.2)             │
  │    joining classes → isolated/initial/medial/final      │
  │    forms → lam-alef ligatures                           │
  ├─────────────────────────────────────────────────────────┤
  │ 2. UAX #9 Bidirectional Algorithm                       │
  │    P1–P3   paragraph split + base direction             │
  │    X1–X10  embeddings, overrides, isolates              │
  │    W1–W7   weak types (numbers, separators, marks)      │
  │    N0–N2   bracket pairs + neutrals                     │
  │    I1–I2   implicit levels                              │
  │    L1, L2  level resets + run reversal                  │
  │    L4      character mirroring  ( ( ↔ ) )               │
  └─────────────────────────────────────────────────────────┘
          │
          ▼
  visual-order string  (what you draw, left to right: "ﻢﻟﺎﻌﻟﺎﺑ ﺎﺒﺣﺮﻣ")
```

Shaping runs first, in logical order, because joining context is defined over logical neighbors; presentation forms keep the `AL` bidi class, so the reorder pass is unaffected. The whole pipeline is code-point based (surrogate-safe — emoji and astral characters count as one unit).

## API

### `render(text, options?) → string`

The one-call pipeline. Returns the shaped, visual-order string. Options as shown above. Plain-ASCII input under `direction: 'auto' | 'ltr'` is returned by reference (zero allocation).

### `analyze(text, options?) → AnalyzeResult`

Everything `render` does, plus the geometry you need for interactive renderers:

```ts
const a = analyze('پa');
a.text;             // 'aﭖ'   — visual-order output
a.direction;        // 'rtl'  — resolved base direction of the first paragraph
a.levels;           // Uint8Array [1, 2] — embedding level per INPUT code point (odd = RTL)
a.visualToLogical;  // [1, 0] — input index shown at each visual position
a.logicalToVisual;  // Int32Array [1, 0] — visual position of each input code point, -1 if removed
```

Positions removed from the output (stripped tashkeel, the alef absorbed into a lam-alef ligature, explicit BiDi controls dropped by rule X9) map to `-1` in `logicalToVisual` and inherit the level of the character they attach to. All indices are **code point** indices, not UTF-16 units.

Use it for: mapping a click on glyph *i* back to the source character, drawing selection rectangles run-by-run, placing carets, underlining a logical range.

### `shape(text, options?) → string`

Arabic shaping only — logical order in, logical order out. Useful when something else (e.g. an existing bidi pass) handles reordering. Options: `{ ligatures, tashkeel }`.

### `reorder(text, options?) → string`

UAX #9 reordering + mirroring only, no shaping. Options: `{ direction, mirror, paragraphs }`.

### `getEmbeddingLevels(text, options?) → Uint8Array`

Resolved embedding level per code point (after L1). Options: `{ direction, paragraphs }`.

### `detectDirection(text) → 'ltr' | 'rtl' | 'neutral'`

First-strong detection per P2/P3 (isolate-skipping). `'neutral'` when no strong character exists — decide your own fallback.

### `UNICODE_VERSION`

The UCD version the bundled tables were generated from (currently `17.0.0`).

## Adapters

Each adapter is a separate entry point — importing one never pulls in the others.

### jsPDF — `bidi-shaper/jspdf`

```ts
import { jsPDF } from 'jspdf';
import { installJsPdfShaper, rtlText } from 'bidi-shaper/jspdf';

// Option A: install once, every doc.text() is processed automatically
installJsPdfShaper(jsPDF.API);

// Option B: per call
doc.text(rtlText('مرحبا بالعالم'), 40, 60);
```

`installJsPdfShaper` registers a `preProcessText` plugin event. Output uses presentation forms (U+FB50–U+FEFF), which jsPDF's built-in arabic parser ignores — no double processing. Embed a font that contains those glyphs (Amiri, Noto Naskh Arabic, Cairo, most Arabic TTFs).

### pdfmake — `bidi-shaper/pdfmake`

```ts
import { shapeDocDefinition } from 'bidi-shaper/pdfmake';

pdfMake.createPdf(
  shapeDocDefinition(docDefinition, { rtlAlignment: true }),
).download();
```

Deep-walks `content`/`header`/`footer` — strings, `text` nodes and arrays, `stack`, `columns`, `ul`/`ol`, and `table.body` cells — returning a new definition (input untouched). `rtlAlignment: true` adds `alignment: 'right'` to RTL text nodes that don't set their own.

### PDFKit — `bidi-shaper/pdfkit`

```ts
import PDFDocument from 'pdfkit';
import { textBidi } from 'bidi-shaper/pdfkit';

textBidi(doc, 'مرحبا بالعالم', 72, 80, { align: 'right' });
textBidi(doc, 'سلام', { align: 'right', bidi: { direction: 'rtl' } }); // (text, options) form works too
```

PDFKit is a special case: its font engine (fontkit) **does** shape Arabic but does **no** BiDi — and reordering first would feed fontkit a mirrored joining context. `textBidi` therefore shapes + reorders here and passes `features: []` so fontkit doesn't re-substitute (supply your own `features` array to override). Regular PDFKit options (`align`, `width`, …) pass through; shaping options go under the `bidi` key.

### Canvas 2D — `bidi-shaper/canvas`

For canvas implementations that don't shape (custom rasterizers, bitmap-font engines, some embedded/offscreen contexts — browser canvas shapes by itself):

```ts
import { fillTextBidi, prepareCanvasText } from 'bidi-shaper/canvas';

fillTextBidi(ctx, 'سلام\nworld', x, y, { align: 'start', lineHeight: 28 });
// 'start'/'end' resolve per line direction: the RTL line anchors right, the LTR line left

const lines = prepareCanvasText(text); // [{ text, direction }, …] if you'd rather draw yourself
```

### three.js — `bidi-shaper/three`

```ts
import { prepareText, prepareLines } from 'bidi-shaper/three';

new TextGeometry(prepareText('مرحبا'), { font, size: 1 });

for (const { text, direction } of prepareLines(label)) {
  // direction tells you which edge to anchor each line to
}
```

Works the same for troika-three-text, BitmapText, SDF/MSDF text plugins — anything that places glyphs in string order.

## Conformance

The complete official Unicode 17.0.0 test suites run in CI on every commit (gzipped fixtures are committed, so the suite is hermetic):

| Suite | What it covers | Cases | Status |
|---|---|---:|---|
| [`BidiTest.txt`](https://www.unicode.org/Public/UCD/latest/ucd/BidiTest.txt) | All Bidi_Class sequences up to length 4 + known-pitfall cases, under auto/LTR/RTL | 770,241 | ✅ all pass |
| [`BidiCharacterTest.txt`](https://www.unicode.org/Public/UCD/latest/ucd/BidiCharacterTest.txt) | Real code-point sequences including paired-bracket resolution (N0/BD16) | 91,707 | ✅ all pass |

```bash
npm run test:conformance
```

**One deliberate deviation, in the string API only:** strict L1+L2 would reverse a trailing paragraph separator (`\n`) to the visual *front* of an RTL line. `render()`/`analyze()` keep separators at their logical positions so line structure survives (`'سلام\nabc'` → `'ﻡﻼﺳ\nabc'`, not `'\nﻡﻼﺳabc'`) — the behavior every practical consumer expects and what fribidi-style `log2vis` APIs do. The conformance harness exercises the spec-pure code path.

## Performance notes

- Property lookups are binary searches over flat `[start, end, value]` typed-array-friendly range tables (529 joining ranges, ~1k bidi-class ranges) — no 1M-entry arrays, no Map allocations at query time.
- Levels, classes, and flags live in `Uint8Array`s; the hot loops are monomorphic.
- Pure-ASCII strings short-circuit across the whole API: `render(s) === s` (same reference), `getEmbeddingLevels`/`analyze` return zeros/identity without running the algorithm — the overwhelmingly common case in mixed-content apps costs ~0.3 µs.
- Real RTL text processes at roughly 150–250k short strings/sec, ~10k ops/sec for 600-character Arabic paragraphs including shaping (Node 22, one laptop core) — on par with reorder-only libraries while also shaping.
- `npm run bench` runs the suite (vs [bidi-js](https://github.com/lojjic/bidi-js) where operations are comparable).
- The full 861k-case conformance run — which is many times more work per string than production text — completes in a few seconds on a laptop.

## Data tables & regeneration

All Unicode data is generated into `src/data/generated/` (committed, reviewed like source) from the UCD by:

```bash
npm run generate-data   # downloads UCD files into scripts/.cache, regenerates tables + fixtures
```

Sources: `DerivedBidiClass.txt`, `BidiMirroring.txt`, `BidiBrackets.txt`, `ArabicShaping.txt`, `UnicodeData.txt`. Bumping to a new Unicode version is a one-command change followed by the conformance suite.

## FAQ

**Do I still need a special font?**
Yes — bidi-shaper selects *which* glyph to draw (e.g. ﻌ instead of ع), but the font must contain Arabic Presentation Forms-A/B (U+FB50–U+FEFF). Amiri, Noto Naskh/Sans Arabic, Cairo, Tajawal, and most Arabic TTFs do. The library ships no fonts.

**When should I *not* use this?**
When a real shaping engine is available: browser DOM/CSS, native text views, HarfBuzz (e.g. `harfbuzzjs`), skia-canvas, node-canvas with Pango. Those produce typographically better results (cursive joining via OpenType, kashida justification, mark positioning). bidi-shaper is for environments where that machinery doesn't exist or costs too much (a HarfBuzz WASM build is ~1 MB; this is ~15 kB).

**Which scripts are covered?**
BiDi reordering: every RTL script (Arabic, Syriac, Thaana, N'Ko, …) — reordering is script-agnostic. Contextual shaping: the Arabic script (Arabic, Persian, Urdu, Kurdish, …), because Unicode only defines presentation forms for Arabic. Syriac/N'Ko cursive shaping needs OpenType, i.e. a real shaping engine.

**What about kashida justification, full ligature sets, mark positioning?**
Out of scope — those are font-level (OpenType) features. You get the standard presentation forms plus the four mandatory lam-alef ligatures, which is exactly what classic Arabic PDF/terminal pipelines use.

**Are ZWJ / ZWNJ honored?** Yes: ZWNJ (U+200C) breaks joining (Persian needs this constantly), ZWJ (U+200D) forces it, tatweel (U+0640) joins both sides. Harakat are transparent to joining and survive shaping (or strip them with `tashkeel: 'strip'` if your renderer can't position combining marks).

**Why does the output look "backwards" in my editor?**
Because it *is* — the output is visual order, and your editor applies its own bidi pass on top, double-reversing it. Judge the output where it will be drawn (the PDF, the canvas), not in a text editor. The [demo](#demo) renders both honestly.

## Alternatives

| | bidi-shaper | [bidi-js](https://github.com/lojjic/bidi-js) | [arabic-persian-reshaper](https://www.npmjs.com/package/arabic-persian-reshaper) | HarfBuzz (WASM) |
|---|---|---|---|---|
| UAX #9 reordering | ✅ full, 861k cases | ✅ full | ❌ | ✅ (via ICU/own) |
| Arabic shaping | ✅ | ❌ | ✅ basic | ✅ full OpenType |
| String-in/string-out | ✅ | ➖ levels/segments API | ✅ | ➖ glyph IDs + positions |
| Hit-testing maps | ✅ `analyze()` | ➖ manual | ❌ | ✅ clusters |
| Size | ~15 kB gzip | small | tiny | ~1 MB WASM |
| Dependencies | 0 | 0 | 0 | WASM binary |

If you need *both* passes as one plain string — the thing PDF generators actually consume — that combination is the reason this library exists.

## Demo

```bash
npm run build
npx serve .          # then open /demo/
node demo/terminal.mjs
```

The browser demo draws every code point individually (the way naive renderers do), so you see the raw breakage and the fix side by side, plus live embedding levels from `analyze()`.

## Development

```bash
npm ci
npm test                 # unit + full conformance (~5 s)
npm run test:coverage    # enforces ≥90% on the algorithm core
npm run typecheck
npm run lint
npm run build            # ESM + CJS + .d.ts via tsup
npm run generate-data    # regenerate Unicode tables from the UCD
```

The UAX #9 core lives in `src/bidi/` (`levels.ts` = X/W/N/I rules, `reorder.ts` = L1/L2), shaping in `src/shape/`, the public API in `src/api/`, generated tables in `src/data/generated/`.

## License

[MIT](./LICENSE). Unicode data files © Unicode, Inc., used under the [Unicode License](https://www.unicode.org/license.txt).
