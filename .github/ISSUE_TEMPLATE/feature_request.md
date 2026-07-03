---
name: Feature request
about: Suggest an option, adapter, or improvement
title: "[feature] "
labels: enhancement
---

**The problem**
What can't you do today? (e.g. a renderer that isn't covered, an option you
need, a shaping/reordering case that's out of scope.)

**Proposed API**
```ts
// how you'd like to call it
```

**Example**
Input string (+ options) → expected visual-order output.

**Notes**
Any reference (UAX #9, Unicode core spec, UCD). Remember bidi-shaper is
zero-dependency by design, and cursive shaping beyond the Arabic presentation
forms (full OpenType joining, kashida, mark positioning) is intentionally out
of scope — that's a job for a real shaping engine.
