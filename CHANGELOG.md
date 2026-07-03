# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

## [0.1.2] - 2026-07-03

### Fixed

- README: replaced badges that render as errors for a freshly published package (npm download stats and bundlephobia lag new releases) with a static, measured gzipped-size badge.

## [0.1.1] - 2026-07-03

### Changed

- Reworked README — masthead, breakage table, CDN usage, per-renderer recipes, engineering notes — so the npm package page matches the repository. No code changes.

## [0.1.0] - 2026-07-03

Initial release.

### Added

- Full UAX #9 Unicode Bidirectional Algorithm: P1–P3, X1–X10 (embeddings, overrides, isolates), W1–W7, N0–N2 with BD16 bracket pairing, I1–I2, L1/L2/L4.
- Conformance harnesses running the complete official suites — `BidiTest.txt` (770,241 cases) and `BidiCharacterTest.txt` (91,707 cases) — against committed, gzipped Unicode 17.0.0 fixtures.
- Arabic contextual shaping: joining-class algorithm (Unicode core spec §9.2), presentation-form substitution (U+FB50–U+FEFF), the four mandatory lam-alef ligatures, ZWJ/ZWNJ/tatweel handling, mark transparency, optional tashkeel stripping.
- Public API: `render`, `analyze` (visual↔logical index maps + embedding levels), `shape`, `reorder`, `getEmbeddingLevels`, `detectDirection`, `UNICODE_VERSION`.
- Adapters: `bidi-shaper/jspdf` (incl. `preProcessText` auto-hook), `bidi-shaper/pdfmake` (document-definition walker), `bidi-shaper/pdfkit` (drop-in `textBidi` that also suppresses fontkit re-shaping), `bidi-shaper/canvas` (fill/stroke/measure + per-line direction), `bidi-shaper/three`.
- Unicode data generator (`npm run generate-data`) producing range-compressed tables from the UCD.
- Browser demo (naive glyph-by-glyph renderer comparison) and terminal demo.
- Benchmark suite (`npm run bench`, tinybench, compared against bidi-js) and ASCII fast paths across `render`/`analyze`/`getEmbeddingLevels`.
- Persian and Urdu shaping coverage (پ گ چ ی، ٹ ھ ے …), including form degradation for letters Unicode gives no medial form (e.g. ں).
- Dual ESM/CJS build with TypeScript declarations for all entry points; CI on Node 20 & 22 (the published package supports Node ≥ 18); npm-provenance release workflow.

### Notes

- String API keeps trailing paragraph separators at their logical position (deliberate, documented deviation from a literal L2 application; the conformance path is spec-pure).
