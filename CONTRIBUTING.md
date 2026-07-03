# Contributing to bidi-shaper

Thanks for your interest in improving bidi-shaper! Bug reports, conformance
fixes, shaping corrections, new renderer adapters and documentation are all
welcome.

## Ways to help

- **Report a bug** or **request a feature** via [issues](https://github.com/cc1a2b/bidi-shaper/issues).
- **Improve correctness** — UAX #9 reordering edge cases or Arabic shaping
  (joining, ligatures, presentation forms). Reports that cite the relevant
  UAX #9 rule (e.g. `W2`, `N0`, `L2`) or a specific Unicode test case are
  especially valuable.
- **Add a renderer adapter** for another glyph-by-glyph target.
- **Add examples or docs.**

## Development setup

```sh
git clone https://github.com/cc1a2b/bidi-shaper
cd bidi-shaper
npm ci
npm test          # unit + the full official UAX #9 conformance suites
npm run typecheck # tsc --noEmit
npm run lint      # eslint
npm run build     # tsup → dist/ (ESM + CJS + d.ts)
```

Requirements: Node.js ≥ 20 for development (the test runner, vitest 4, needs it). The published package itself supports Node ≥ 18.

## Guidelines

- **Zero runtime dependencies** is a hard rule — please don't add any.
- **The conformance suites must stay green.** `npm test` runs the complete
  official `BidiTest.txt` and `BidiCharacterTest.txt` (861,948 cases) against
  committed, gzipped Unicode fixtures. Any change to `src/bidi/` must keep them
  at 100%.
- **Add tests** for every behavioural change; keep the suite green.
- **Keep types accurate** and add a JSDoc `@example` for new public functions.
- **Match the existing style** (formatting, naming, comment density).
- **Generated Unicode tables** in `src/data/generated/` come from
  `npm run generate-data` (which downloads the UCD into `scripts/.cache`) —
  don't hand-edit them. Bumping the Unicode version is a one-command change
  followed by the conformance suite.
- For anything reordering- or shaping-related, **cite a source** in the PR:
  the [UAX #9](https://www.unicode.org/reports/tr9/) rule, the Unicode core
  spec §9.2 (Arabic shaping), or the relevant UCD data file.

## Lockfile note

If your change touches dependencies, regenerate the lockfile from a **clean**
install so all platforms' optional binaries are recorded:

```sh
rm -rf node_modules package-lock.json
npm install
```

(An incremental `npm install` on some platforms can drop other platforms'
optional native binaries and break CI on a different OS.)

## Pull requests

1. Branch from `main`.
2. Make focused commits with clear messages.
3. Ensure `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`
   all pass.
4. Open the PR and fill in the template.

By contributing you agree your contributions are licensed under the project's
[MIT license](./LICENSE).
