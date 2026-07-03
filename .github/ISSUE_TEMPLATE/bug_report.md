---
name: Bug report
about: Text reorders or shapes incorrectly, or something doesn't work
title: "[bug] "
labels: bug
---

**What happened**
A clear description of the bug.

**Minimal reproduction**
```ts
import { render } from "bidi-shaper";
render("…"); // the smallest input + options that show the problem
```

**Expected output**
The correct visual-order output. If this is a reordering/shaping correctness
issue, please cite the relevant rule or test case if you can:
[UAX #9](https://www.unicode.org/reports/tr9/) rule (e.g. `W2`, `N0`, `L2`),
the Unicode core spec §9.2 (shaping), or a line from `BidiCharacterTest.txt`.

**Actual output**
What you got instead. Code-point values (`U+….`) help, since visual-order text
looks "backwards" in editors.

**Environment**
- bidi-shaper version:
- Node / browser / runtime:
- Renderer / adapter (jsPDF, pdfmake, PDFKit, canvas, three.js, …):
- OS:
