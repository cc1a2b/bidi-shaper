<div align="center">

# bidi-shaper

### Unicode BiDi + Arabic shaping for renderers that can't do either

Logical→visual **UAX #9** reordering · Arabic contextual shaping · lam-alef ligatures · bracket mirroring —<br/>
one plain string out, ready for **jsPDF, pdfmake, PDFKit, canvas, three.js, terminals and game engines**. Zero dependencies.

<p lang="ar" dir="rtl"><em>يُخزَّن النصُّ بترتيب القراءة ويُرسَم بترتيب الرؤية — وهذه المسافة بينهما هي عملي.</em></p>

[![CI](https://github.com/cc1a2b/bidi-shaper/actions/workflows/ci.yml/badge.svg)](https://github.com/cc1a2b/bidi-shaper/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/bidi-shaper?style=flat-square&color=brightgreen)](https://www.npmjs.com/package/bidi-shaper) [![gzipped size](https://img.shields.io/badge/gzipped-15%20kB-blue?style=flat-square)](https://www.npmjs.com/package/bidi-shaper) [![UAX #9 conformance](https://img.shields.io/badge/UAX%20%239-861%2C948%20cases%20pass-3fb950?style=flat-square)](#conformance--all-861948-official-cases) [![Unicode 17.0.0](https://img.shields.io/badge/Unicode-17.0.0-5d3fd3?style=flat-square)](https://www.unicode.org/versions/Unicode17.0.0/) [![zero dependencies](https://img.shields.io/badge/deps-0-brightgreen?style=flat-square)](./package.json) [![types included](https://img.shields.io/npm/types/bidi-shaper?style=flat-square)](https://www.npmjs.com/package/bidi-shaper)

**[npm](https://www.npmjs.com/package/bidi-shaper) · [Live demo](https://bidi-shaper.vercel.app) · [GitHub](https://github.com/cc1a2b/bidi-shaper)**

</div>

> **bidi-shaper** runs the two invisible passes every browser and native text stack performs before a glyph hits the screen — the **Unicode Bidirectional Algorithm (UAX #9)** and **Arabic contextual shaping** — and hands you a plain string in final visual order. Renderers that place glyphs one after another (PDF generators, bitmap-font game engines, WebGL text, plotters, e-ink dashboards) draw it correctly, glyph by glyph, left to right. Pure TypeScript, verified against **all 861,948 official Unicode conformance cases**, in **~15 kB** gzipped.

```sh
npm install bidi-shaper
```

```ts
import { render } from "bidi-shaper";

doc.text(render("مرحبا بالعالم"), 40, 60); // jsPDF — and now the Arabic is readable
```

---

## What breaks without it

Give a glyph-by-glyph renderer logical-order Arabic and every one of these goes wrong at once:

| Failure | Naive renderer (raw string, left→right) | Through `render()` |
|---|---|---|
| Cursive joining | isolated, disconnected letters — ك ت ا ب | contextual forms — <span dir="rtl">كتاب</span> |
| Reading direction | RTL words come out reversed, end-first | RTL runs flow right-to-left, LTR stays LTR |
| Numbers inside RTL | drift to the wrong end of the sentence | stay left-to-right, in place — <span dir="rtl">سنة ١٤٤٧</span> |
| Mixed Arabic + English | word order scrambles mid-sentence | each run in its own direction (UAX #9 levels) |
| Brackets & parentheses | `(` points the wrong way on RTL runs | mirrored per rule L4 — <span dir="rtl">قائمة (أ)</span> |
| lam + alef | two stray letters — ل ا | one mandatory ligature — ﻻ |
| Harakat / tashkeel | break joining, or crash the renderer | transparent to joining; keep or strip them |
| Persian & Urdu letters | پ گ چ ژ ٹ ڈ ے left unjoined | full Arabic-script shaping, not just Arabic |

**Who needs this:** jsPDF · pdfmake · PDFKit-style generators · custom canvas rasterizers · bitmap-font engines · three.js `TextGeometry` / troika-text · SDF/MSDF text · terminal UIs · plotters · e-ink dashboards.
**Who doesn't:** browser DOM/CSS, native text views, HarfBuzz-based stacks — they already run both passes (and with full OpenType typography).

---

## Install

```sh
npm install bidi-shaper
# or
yarn add bidi-shaper
# or
pnpm add bidi-shaper
```

**Requirements:** Node.js ≥ 18 or any modern browser/bundler · TypeScript optional · zero runtime dependencies. No native modules, no WASM, no fonts shipped.

### Browser / CDN — no build step

Every release is mirrored on [jsDelivr](https://www.jsdelivr.com/package/npm/bidi-shaper) and [unpkg](https://unpkg.com/browse/bidi-shaper/) automatically:

```html
<script type="module">
  import { render, analyze } from "https://cdn.jsdelivr.net/npm/bidi-shaper/+esm";

  ctx.fillText(render("مرحبا بالعالم"), x, y); // your own rasterizer, fixed
</script>
```

Adapter subpaths are single files too — e.g. `https://cdn.jsdelivr.net/npm/bidi-shaper/dist/adapters/jspdf.js`. Pin a version for production (`bidi-shaper@0.1`).

---

## Quick start

```ts
import {
  render,              // the one-call pipeline: shape → reorder → mirror
  analyze,             // render + embedding levels + visual↔logical index maps
  shape,               // Arabic shaping only (logical order in, logical order out)
  reorder,             // UAX #9 reordering + mirroring only, no shaping
  getEmbeddingLevels,  // resolved level per code point (odd = RTL)
  detectDirection,     // first-strong direction: 'ltr' | 'rtl' | 'neutral'
  UNICODE_VERSION,     // the UCD version the tables were generated from
} from "bidi-shaper";

render("مرحبا بالعالم");        // 'ﻢﻟﺎﻌﻟﺎﺑ ﺎﺒﺣﺮﻣ'  shaped + reordered
render("سلام دنیا");            // 'ﺎﯿﻧﺩ ﻡﻼﺳ'        Persian works the same
render("قیمت: 123.45");         // '123.45 :ﺖﻤﯿﻗ'    numbers stay LTR
render("قائمة (أ)");            // brackets mirrored correctly
render("hello world");          // 'hello world'      ASCII fast path: returned as-is
```

Everything is configurable:

```ts
render(text, {
  direction: "auto",   // 'auto' | 'ltr' | 'rtl' — base paragraph direction (P2/P3 first-strong)
  shape: true,         // Arabic presentation forms (default true)
  ligatures: true,     // lam-alef ligatures (default true)
  mirror: true,        // L4 bracket mirroring (default true)
  tashkeel: "keep",    // 'keep' | 'strip' Arabic diacritics (default 'keep')
  paragraphs: "split", // 'split' | 'single' — reorder each \n-paragraph separately
});
```

---

## The problem in 30 seconds

Browsers, iOS/Android text views, and HarfBuzz-based stacks run two invisible passes before any glyph hits the screen:

1. **The Unicode Bidirectional Algorithm (UAX #9)** — Arabic and other right-to-left scripts are *stored* in reading order ("logical order") but *drawn* right-to-left, with numbers and embedded Latin still flowing left-to-right. Something has to compute the final left-to-right glyph sequence ("visual order").
2. **Arabic contextual shaping** — Arabic letters are cursive: the same letter takes a different form when it starts, continues, or ends a word (ع ﻋ ﻌ ﻊ are all one letter). Fonts handle this through shaping engines.

Renderers that place glyphs one after another run **neither** pass. bidi-shaper runs both in pure TypeScript and hands you a plain string in final visual order. Draw it left-to-right, glyph by glyph, and it's right.

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

Shaping runs first, in logical order, because joining context is defined over logical neighbors; presentation forms keep the `AL` bidi class, so the reorder pass is unaffected. The whole pipeline is code-point based — surrogate-safe, emoji and astral characters count as one unit.

---

## API

### `render(text, options?) → string`

The one-call pipeline. Returns the shaped, visual-order string. Plain-ASCII input under `direction: 'auto' | 'ltr'` is returned **by reference** (zero allocation) — mixed-content apps pay nothing for the common case.

### `analyze(text, options?) → AnalyzeResult`

Everything `render` does, plus the geometry interactive renderers need:

```ts
const a = analyze("پa");
a.text;             // 'aﭖ'   — visual-order output
a.direction;        // 'rtl'  — resolved base direction of the first paragraph
a.levels;           // Uint8Array [1, 2] — embedding level per INPUT code point (odd = RTL)
a.visualToLogical;  // [1, 0] — input index shown at each visual position
a.logicalToVisual;  // Int32Array [1, 0] — visual position of each input code point, -1 if removed
```

Use it for: mapping a click on glyph *i* back to the source character, drawing selection rectangles run-by-run, placing carets, underlining a logical range. Positions removed from the output (stripped tashkeel, the alef absorbed into a lam-alef ligature, explicit BiDi controls dropped by rule X9) map to `-1` in `logicalToVisual` and inherit the level of the character they attach to. All indices are **code point** indices, not UTF-16 units.

### `shape(text, options?) → string`

Arabic shaping only — logical order in, logical order out. Useful when something else (e.g. an existing bidi pass) handles reordering. Options: `{ ligatures, tashkeel }`.

### `reorder(text, options?) → string`

UAX #9 reordering + mirroring only, no shaping. Options: `{ direction, mirror, paragraphs }`.

### `getEmbeddingLevels(text, options?) → Uint8Array`

Resolved embedding level per code point (after L1). Odd levels render right-to-left. Options: `{ direction, paragraphs }`.

### `detectDirection(text) → 'ltr' | 'rtl' | 'neutral'`

First-strong detection per P2/P3 (isolate-skipping). `'neutral'` when no strong character exists — decide your own fallback.

### `UNICODE_VERSION`

The UCD version the bundled tables were generated from (currently `17.0.0`).

---

## Adapters — wire it to your renderer

Each adapter is a separate entry point and is **structurally typed** — it never imports the host library, so it adds nothing to your bundle beyond the engine itself.

| Renderer | Import | One-liner |
|---|---|---|
| jsPDF | `bidi-shaper/jspdf` | `installJsPdfShaper(jsPDF.API)` — every `doc.text()` fixed automatically |
| pdfmake | `bidi-shaper/pdfmake` | `shapeDocDefinition(def)` — deep-walks the whole document definition |
| PDFKit | `bidi-shaper/pdfkit` | `textBidi(doc, text, x, y)` — also stops fontkit from re-shaping |
| Canvas 2D | `bidi-shaper/canvas` | `fillTextBidi(ctx, text, x, y)` — per-line direction-aware alignment |
| three.js | `bidi-shaper/three` | `prepareText(label)` — feed to `TextGeometry` / troika / bitmap text |
| anything else | `bidi-shaper` | `render(text)` — the universal move |

### jsPDF

```ts
import { jsPDF } from "jspdf";
import { installJsPdfShaper, rtlText } from "bidi-shaper/jspdf";

// Option A: install once, every doc.text() is processed automatically
installJsPdfShaper(jsPDF.API);

// Option B: per call
doc.text(rtlText("مرحبا بالعالم"), 40, 60);
```

`installJsPdfShaper` registers a `preProcessText` plugin event. Output uses presentation forms (U+FB50–U+FEFF), which jsPDF's built-in arabic parser ignores — no double processing. Embed a font that contains those glyphs (Amiri, Noto Naskh Arabic, Cairo, most Arabic TTFs).

### pdfmake

```ts
import { shapeDocDefinition } from "bidi-shaper/pdfmake";

pdfMake.createPdf(
  shapeDocDefinition(docDefinition, { rtlAlignment: true }),
).download();
```

Deep-walks `content`/`header`/`footer` — strings, `text` nodes and arrays, `stack`, `columns`, `ul`/`ol`, and `table.body` cells — returning a new definition (input untouched). `rtlAlignment: true` adds `alignment: 'right'` to RTL text nodes that don't set their own.

### PDFKit

```ts
import PDFDocument from "pdfkit";
import { textBidi } from "bidi-shaper/pdfkit";

textBidi(doc, "مرحبا بالعالم", 72, 80, { align: "right" });
textBidi(doc, "سلام", { align: "right", bidi: { direction: "rtl" } }); // (text, options) form works too
```

PDFKit is a special case: its font engine (fontkit) **does** shape Arabic but does **no** BiDi — and reordering first would feed fontkit a mirrored joining context. `textBidi` therefore shapes + reorders here and passes `features: []` so fontkit doesn't re-substitute (supply your own `features` array to override). Regular PDFKit options (`align`, `width`, …) pass through; shaping options go under the `bidi` key.

### Canvas 2D

For canvas implementations that don't shape — custom rasterizers, bitmap-font engines, some embedded/offscreen contexts (browser canvas shapes by itself):

```ts
import { fillTextBidi, prepareCanvasText } from "bidi-shaper/canvas";

fillTextBidi(ctx, "سلام\nworld", x, y, { align: "start", lineHeight: 28 });
// 'start'/'end' resolve per line direction: the RTL line anchors right, the LTR line left

const lines = prepareCanvasText(text); // [{ text, direction }, …] if you'd rather draw yourself
```

### three.js

```ts
import { prepareText, prepareLines } from "bidi-shaper/three";

new TextGeometry(prepareText("مرحبا"), { font, size: 1 });

for (const { text, direction } of prepareLines(label)) {
  // direction tells you which edge to anchor each line to
}
```

Works the same for troika-three-text, BitmapText, SDF/MSDF text plugins — anything that places glyphs in string order.

---

## Recipes

### An Arabic invoice in jsPDF

```ts
import { jsPDF } from "jspdf";
import { installJsPdfShaper } from "bidi-shaper/jspdf";

const doc = new jsPDF();
doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
doc.setFont("Amiri");
installJsPdfShaper(jsPDF.API);          // one line — every string below just works

doc.text("فاتورة ضريبية", 200, 20, { align: "right" });
doc.text("الإجمالي: 1,250.00 ريال", 200, 40, { align: "right" });
doc.save("invoice.pdf");
```

### A server-rendered PDF (Node + PDFKit)

```ts
import PDFDocument from "pdfkit";
import { textBidi } from "bidi-shaper/pdfkit";

const doc = new PDFDocument();
doc.pipe(res);
doc.font("fonts/NotoNaskhArabic-Regular.ttf").fontSize(16);
textBidi(doc, "تقرير المبيعات — سنة ١٤٤٧", { align: "right" });
doc.end();
```

### Hit-testing a custom text editor / canvas UI

```ts
import { analyze } from "bidi-shaper";

const a = analyze(sourceText);
// draw a.text glyph-by-glyph, remembering each glyph's x-position…
const clickedVisual = xToGlyphIndex(clickX);
const sourceIndex = a.visualToLogical[clickedVisual]; // caret goes HERE in the stored string
```

---

## Conformance — all 861,948 official cases

The complete official Unicode 17.0.0 test suites run in CI on every commit. Not a sample — the whole thing, both suites, pinned at 100%:

| Suite | What it covers | Cases | Status |
|---|---|---:|---|
| [`BidiTest.txt`](https://www.unicode.org/Public/UCD/latest/ucd/BidiTest.txt) | All Bidi_Class sequences up to length 4 + known-pitfall cases, under auto/LTR/RTL | 770,241 | all pass |
| [`BidiCharacterTest.txt`](https://www.unicode.org/Public/UCD/latest/ucd/BidiCharacterTest.txt) | Real code-point sequences including paired-bracket resolution (N0/BD16) | 91,707 | all pass |

```sh
npm run test:conformance
```

Gzipped fixtures are committed, so the suite is hermetic — no network, no version drift. The full run completes in a few seconds.

**One deliberate deviation, in the string API only:** strict L1+L2 would reverse a trailing paragraph separator (`\n`) to the visual *front* of an RTL line. `render()`/`analyze()` keep separators at their logical positions so line structure survives (`'سلام\nabc'` → `'ﻡﻼﺳ\nabc'`, not `'\nﻡﻼﺳabc'`) — the behavior every practical consumer expects and what fribidi-style `log2vis` APIs do. The conformance harness exercises the spec-pure code path.

---

## Engineering

| | |
|---|---|
| **Dependencies** | Zero runtime dependencies — no WASM, no native modules, no fonts |
| **Size** | ~15 kB min+gzip including all Unicode tables |
| **Formats** | Dual ESM + CJS, full `.d.ts` / `.d.cts` types, all six entry points |
| **Type resolution** | Green across `node10` / `node16` / `bundler` on [arethetypeswrong](https://arethetypeswrong.github.io/) — subpath types work even on legacy `moduleResolution` |
| **Tree-shaking** | `"sideEffects": false` — adapters never import their host library |
| **Correctness** | 861,948 official UAX #9 conformance cases + unit suite, on every commit |
| **Data source** | Generated from the UCD (`DerivedBidiClass`, `BidiMirroring`, `BidiBrackets`, `ArabicShaping`, `UnicodeData`) — committed and reviewed like source |
| **Platforms** | Node ≥ 18, all evergreen browsers, Deno, Bun, workers — anywhere strings exist |
| **Surrogate-safe** | Code-point based throughout; emoji and astral characters count as one unit |

### Performance

- Property lookups are binary searches over flat `[start, end, value]` range tables (529 joining ranges, ~1k bidi-class ranges) — no megabyte lookup arrays, no Map allocations at query time.
- Levels, classes, and flags live in `Uint8Array`s; the hot loops are monomorphic.
- Pure-ASCII strings short-circuit across the whole API: `render(s) === s` (same reference), `analyze`/`getEmbeddingLevels` return zeros/identity without running the algorithm — ~0.3 µs for the overwhelmingly common case in mixed-content apps.
- Real RTL text processes at roughly **150–250k short strings/sec**, ~10k ops/sec for 600-character Arabic paragraphs including shaping (Node 22, one laptop core).
- `npm run bench` runs the suite (tinybench).

---

## Data tables & regeneration

All Unicode data is generated into `src/data/generated/` (committed, reviewed like source) from the UCD:

```sh
npm run generate-data   # downloads UCD files into scripts/.cache, regenerates tables + fixtures
```

Bumping to a new Unicode version is a one-command change followed by the conformance suite.

---

## FAQ

**Do I still need a special font?**
Yes — bidi-shaper selects *which* glyph to draw (e.g. ﻌ instead of ع), but the font must contain Arabic Presentation Forms-A/B (U+FB50–U+FEFF). Amiri, Noto Naskh/Sans Arabic, Cairo, Tajawal, and most Arabic TTFs do. The library ships no fonts.

**When should I *not* use this?**
When a real shaping engine is available: browser DOM/CSS, native text views, HarfBuzz (e.g. `harfbuzzjs`), skia-canvas, node-canvas with Pango. Those produce typographically better results (cursive joining via OpenType, kashida justification, mark positioning). bidi-shaper is for environments where that machinery doesn't exist or costs too much — a HarfBuzz WASM build is ~1 MB; this is ~15 kB.

**Which scripts are covered?**
BiDi reordering: every RTL script (Arabic, Hebrew, Syriac, Thaana, N'Ko, …) — reordering is script-agnostic. Contextual shaping: the Arabic script (Arabic, Persian, Urdu, Kurdish, …), because Unicode only defines presentation forms for Arabic. Syriac/N'Ko cursive shaping needs OpenType, i.e. a real shaping engine.

**What about kashida justification, full ligature sets, mark positioning?**
Out of scope — those are font-level (OpenType) features. You get the standard presentation forms plus the four mandatory lam-alef ligatures, which is exactly what classic Arabic PDF/terminal pipelines use.

**Are ZWJ / ZWNJ honored?**
Yes: ZWNJ (U+200C) breaks joining (Persian needs this constantly), ZWJ (U+200D) forces it, tatweel (U+0640) joins both sides. Harakat are transparent to joining and survive shaping — or strip them with `tashkeel: 'strip'` if your renderer can't position combining marks.

**Why does the output look "backwards" in my editor?**
Because it *is* — the output is visual order, and your editor applies its own bidi pass on top, double-reversing it. Judge the output where it will be drawn (the PDF, the canvas), not in a text editor. The [demo](https://bidi-shaper.vercel.app) renders both honestly.

**How do I get correct Arabic in jsPDF?**
`npm install bidi-shaper`, then `installJsPdfShaper(jsPDF.API)` once — every `doc.text()` call is fixed automatically. Embed an Arabic font (Amiri, Noto Naskh). [Details ↑](#jspdf)

---

## Live demo

**[bidi-shaper.vercel.app](https://bidi-shaper.vercel.app)** — an interactive instrument, computed live in your browser by the library source. Step your own text through the actual algorithm phases — shape, level, the L2 reordering cascade (deepest runs reverse first), mirror — and watch a naive renderer draw the before/after. Embedding levels, visual↔logical routing, contextual forms, all live.

Run it locally:

```sh
cd demo && npm install && npm run dev    # browser demo (Vite)
npm run build && node demo/terminal.mjs  # terminal demo
```

---

## Development

```sh
npm ci
npm test                 # unit + full conformance (~5 s)
npm run test:coverage    # enforces ≥90% on the algorithm core
npm run typecheck
npm run lint
npm run build            # ESM + CJS + .d.ts via tsup
npm run generate-data    # regenerate Unicode tables from the UCD
```

The UAX #9 core lives in `src/bidi/` (`levels.ts` = X/W/N/I rules, `reorder.ts` = L1/L2), shaping in `src/shape/`, the public API in `src/api/`, generated tables in `src/data/generated/`. See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines — correctness reports citing a UAX #9 rule or Unicode test case are especially welcome.

---

## Contributing

Issues and pull requests are welcome on [GitHub](https://github.com/cc1a2b/bidi-shaper/issues). Security reports: see [SECURITY.md](./SECURITY.md).

---

## License

[MIT](./LICENSE) — free for commercial and personal use. Unicode data files © Unicode, Inc., used under the [Unicode License](https://www.unicode.org/license.txt).

---

## Author & more projects

Built and maintained by **[cc1a2b](https://github.com/cc1a2b)**.

If bidi-shaper saves you time, please **[star it on GitHub](https://github.com/cc1a2b/bidi-shaper)** — it helps other developers find it. You might also like **[arabicfmt](https://github.com/cc1a2b/arabicfmt)** — Arabic-first formatting (currency, Hijri dates, تفقيط, plurals) from the same author — or explore [other open-source projects](https://github.com/cc1a2b?tab=repositories).

<div align="center">
<sub>Built for wherever your glyphs land · <bdi lang="ar">وقفٌ للمطوّرين</bdi></sub>
</div>
