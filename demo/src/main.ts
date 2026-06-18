import "./style.css";
import { render, analyze, shape, UNICODE_VERSION, type RenderOptions } from "bidi-shaper";

/* ----------------------------------------------------------------
   bidi-shaper demo — everything on this page is computed live by the
   library source in ../src. The two passes (UAX #9 reordering + Arabic
   shaping) run in your browser; nothing here is precomputed.
   ---------------------------------------------------------------- */

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};
const h = (tag: string, cls?: string, text?: string): HTMLElement => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
};
const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/* ================================================================
   THE LOOM — the signature element.
   analyze() gives a level per code point plus visual↔logical maps.
   We draw the stored (logical) string on top, the drawn (visual)
   string below, and a thread from every character to where it ends
   up — coloured by embedding level. Threads cross exactly where the
   algorithm reorders. Nothing is faked: it is analyze() on screen.
   ================================================================ */
const LOOM_RED = "#b3402e";
const LOOM_LAPIS = "#37507a";
const LOOM_MAX = 38;
const LOOM_SAMPLES = ["مرحبا 2024", "سعر 250 ريال", "Hello مرحبا", "سنة ١٤٤٧", "قائمة (أ)"];

const loomHost = $("loom");
const loomInput = $<HTMLInputElement>("loom-input");
const loomSamplesWrap = $("loom-samples");
const loomDir = $("loom-dir");
let loomI = 0;
let loomTimer = 0;
let loomTouched = false;

function buildLoom(input: string, animate: boolean): void {
  const a = analyze(input);
  let logical = [...input];
  const visual = [...a.text];
  const levels = a.levels;
  if (logical.length > LOOM_MAX) logical = logical.slice(0, LOOM_MAX);
  const n = logical.length;
  const m = visual.length;

  loomDir.innerHTML = n ? `base <b>${a.direction}</b> · ${m} glyph${m === 1 ? "" : "s"}` : "";
  if (n === 0) {
    loomHost.innerHTML = "";
    return;
  }

  const availW = loomHost.clientWidth || 880;
  const cols = Math.max(n, m, 1);
  const tileGap = 6;
  const cellW = Math.max(30, Math.min(54, Math.floor(availW / cols)));
  const padX = 4;
  const totalW = padX * 2 + cols * cellW;

  const topLblY = 11;
  const ltY = 26;
  const tileH = 42;
  const threadSpan = 126;
  const vtY = ltY + tileH + threadSpan;
  const vIdxY = vtY + tileH + 14;
  const botLblY = vtY + tileH + 30;
  const H = vtY + tileH + 38;

  const cx = (c: number): number => padX + c * cellW + cellW / 2;
  const r = (x: number): number => Math.round(x * 10) / 10;

  const threads: string[] = [];
  const ltiles: string[] = [];
  const vtiles: string[] = [];

  for (let i = 0; i < n; i++) {
    const v = a.logicalToVisual[i] ?? -1;
    const rtl = (levels[i] ?? 0) % 2 === 1;
    const col = rtl ? LOOM_RED : LOOM_LAPIS;
    const bx = padX + i * cellW + tileGap / 2;
    const bw = cellW - tileGap;
    const dim = v < 0 ? ' opacity="0.4"' : "";
    ltiles.push(
      `<g class="loom-tilegroup" data-li="${i}" data-vi="${v}"${dim}>` +
        `<rect class="loom-tilebox" x="${r(bx)}" y="${ltY}" width="${r(bw)}" height="${tileH}" rx="4"/>` +
        `<rect x="${r(bx)}" y="${ltY + tileH - 3}" width="${r(bw)}" height="3" rx="1.5" fill="${col}" opacity="${v < 0 ? 0.25 : 0.85}"/>` +
        `<text class="loom-glyph" x="${r(cx(i))}" y="${r(ltY + tileH / 2)}">${esc(logical[i] ?? "")}</text>` +
        `<text class="loom-idx" x="${r(cx(i))}" y="${topLblY + 8}">${i}</text>` +
        `</g>`,
    );
    if (v >= 0 && v < m) {
      const x1 = cx(i);
      const y1 = ltY + tileH;
      const x2 = cx(v);
      const y2 = vtY;
      const d = `M${r(x1)},${r(y1)} C${r(x1)},${r(y1 + threadSpan * 0.45)} ${r(x2)},${r(y2 - threadSpan * 0.45)} ${r(x2)},${r(y2)}`;
      const delay = animate ? ` style="animation-delay:${(i * 0.035).toFixed(3)}s"` : "";
      threads.push(`<path class="loom-thread" data-li="${i}" data-vi="${v}" pathLength="1" d="${d}" stroke="${col}"${delay}/>`);
    }
  }

  for (let v = 0; v < m; v++) {
    const i = a.visualToLogical[v] ?? 0;
    const rtl = (levels[i] ?? 0) % 2 === 1;
    const col = rtl ? LOOM_RED : LOOM_LAPIS;
    const bx = padX + v * cellW + tileGap / 2;
    const bw = cellW - tileGap;
    const delay = animate ? ` style="animation-delay:${(0.22 + v * 0.03).toFixed(3)}s"` : "";
    vtiles.push(
      `<g class="loom-tilegroup" data-li="${i}" data-vi="${v}"${delay}>` +
        `<rect class="loom-tilebox visual" x="${r(bx)}" y="${vtY}" width="${r(bw)}" height="${tileH}" rx="4"/>` +
        `<rect x="${r(bx)}" y="${vtY}" width="${r(bw)}" height="3" rx="1.5" fill="${col}"/>` +
        `<text class="loom-glyph" x="${r(cx(v))}" y="${r(vtY + tileH / 2)}">${esc(visual[v] ?? "")}</text>` +
        `<text class="loom-idx" x="${r(cx(v))}" y="${vIdxY}" fill="${col}">${i}</text>` +
        `</g>`,
    );
  }

  const lblTop = `<text class="loom-rowlabel" x="${padX + 2}" y="${topLblY}">STORED — reading order&#160;&#160;<tspan class="accent">→</tspan></text>`;
  const lblBot = `<text class="loom-rowlabel" x="${padX + 2}" y="${botLblY}">DRAWN — visual order, left-to-right&#160;&#160;<tspan class="accent">→</tspan></text>`;

  loomHost.innerHTML =
    `<svg class="loom-svg${animate ? " loom-anim" : ""}" width="${totalW}" height="${H}" viewBox="0 0 ${totalW} ${H}" role="img" aria-label="logical to visual order">` +
    lblTop +
    threads.join("") +
    ltiles.join("") +
    vtiles.join("") +
    lblBot +
    `</svg>`;
  wireLoomHover();
}

function wireLoomHover(): void {
  const svg = loomHost.querySelector("svg");
  if (!svg) return;
  const all = svg.querySelectorAll<SVGElement>(".loom-thread, .loom-tilegroup");
  const clear = (): void => all.forEach((el) => el.classList.remove("loom-faded", "loom-hot"));
  all.forEach((el) => {
    el.addEventListener("mouseenter", () => {
      const li = el.getAttribute("data-li");
      const vi = el.getAttribute("data-vi");
      if (li == null || vi == null || vi === "-1") return;
      all.forEach((other) => {
        const match = other.getAttribute("data-li") === li && other.getAttribute("data-vi") === vi;
        other.classList.toggle("loom-hot", match);
        other.classList.toggle("loom-faded", !match);
      });
    });
  });
  svg.addEventListener("mouseleave", clear);
}

function setLoom(text: string, animate: boolean): void {
  loomInput.value = text;
  buildLoom(text, animate);
  [...loomSamplesWrap.children].forEach((b) => b.classList.toggle("active", b.textContent === text));
}
function touchLoom(): void {
  if (loomTouched) return;
  loomTouched = true;
  window.clearInterval(loomTimer);
}

for (const s of LOOM_SAMPLES) {
  const b = h("button", undefined, s);
  b.setAttribute("dir", "auto");
  b.addEventListener("click", () => {
    touchLoom();
    setLoom(s, true);
  });
  loomSamplesWrap.append(b);
}
loomInput.addEventListener("input", () => {
  touchLoom();
  buildLoom(loomInput.value, false);
  [...loomSamplesWrap.children].forEach((b) => b.classList.remove("active"));
});
loomInput.addEventListener("focus", touchLoom);

/* ---------- canvas: draw each code point left-to-right ----------
   This is exactly how a shaping-unaware, bidi-unaware renderer behaves:
   one glyph after another. Feed it the raw string → broken. Feed it
   render(string) → correct, because the string is already shaped and
   in visual order. */
const CANVAS_FONT = '30px Amiri, "Noto Naskh Arabic", "Segoe UI", serif';
const canvasJobs = new Map<HTMLCanvasElement, { text: string; color: string }>();

function drawNaive(canvas: HTMLCanvasElement, text: string, color: string): void {
  canvasJobs.set(canvas, { text, color });
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 640;
  const hgt = 54;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.round(hgt * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, hgt);
  ctx.font = CANVAS_FONT;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  let x = 6;
  const firstLine = text.split("\n")[0] ?? "";
  for (const ch of firstLine) {
    ctx.fillText(ch, x, hgt / 2 + 1);
    x += ctx.measureText(ch).width;
  }
}
const redrawAll = (): void => {
  for (const [canvas, job] of canvasJobs) drawNaive(canvas, job.text, job.color);
};

/* ---------- proof sheet (auto-cycling before/after, on the dark band) ---------- */
const PROOF_INK = "#f0e7d4";
const PROOF = [
  "مرحبا بالعالم",
  "بِسْمِ اللَّهِ",
  "سلام دنیا ۱۲۳",
  "اردو میں خوش آمدید",
  'العنوان "مفتاح المعاني"',
];
const proofRaw = $<HTMLCanvasElement>("proof-raw");
const proofFixed = $<HTMLCanvasElement>("proof-fixed");
const dotsWrap = $("proof-dots");
let proofI = 0;
let proofTimer = 0;

PROOF.forEach((_, i) => {
  const dot = h("i");
  dot.addEventListener("click", () => {
    proofI = i;
    showProof();
    restartProof();
  });
  dotsWrap.append(dot);
});

function showProof(): void {
  const sample = PROOF[proofI] ?? "";
  drawNaive(proofRaw, sample, PROOF_INK);
  drawNaive(proofFixed, render(sample), PROOF_INK);
  [...dotsWrap.children].forEach((d, i) => d.classList.toggle("on", i === proofI));
}
function restartProof(): void {
  window.clearInterval(proofTimer);
  proofTimer = window.setInterval(() => {
    proofI = (proofI + 1) % PROOF.length;
    showProof();
  }, 2900);
}

/* ---------- the bench (interactive pipeline) ---------- */
const INK = "#1b1710";
const BENCH_SAMPLES: [string, string][] = [
  ["Arabic", "مرحبا بالعالم"],
  ["Persian", "سلام دنیا ۱۲۳"],
  ["Urdu", "اردو میں خوش آمدید"],
  ["Mixed", 'The title is "مفتاح المعاني" in Arabic.'],
  ["Numbers", "الفاتورة 1250 ريال"],
  ["Tashkeel", "بِسْمِ اللَّهِ"],
];
const benchInput = $<HTMLTextAreaElement>("bench-input");
const benchRaw = $<HTMLCanvasElement>("bench-raw");
const benchFixed = $<HTMLCanvasElement>("bench-fixed");
const benchOut = $("bench-out");

function benchOptions(): RenderOptions {
  return {
    direction: $<HTMLSelectElement>("opt-dir").value as RenderOptions["direction"],
    shape: $<HTMLInputElement>("opt-shape").checked,
    ligatures: $<HTMLInputElement>("opt-liga").checked,
    mirror: $<HTMLInputElement>("opt-mirror").checked,
    tashkeel: $<HTMLInputElement>("opt-strip").checked ? "strip" : "keep",
  };
}
function updateBench(): void {
  const out = render(benchInput.value, benchOptions());
  drawNaive(benchRaw, benchInput.value, INK);
  drawNaive(benchFixed, out, INK);
  benchOut.textContent = out || " ";
}

const benchSampleWrap = $("bench-samples");
for (const [label, text] of BENCH_SAMPLES) {
  const b = h("button", undefined, label);
  b.addEventListener("click", () => {
    benchInput.value = text;
    updateBench();
  });
  benchSampleWrap.append(b);
}
benchInput.addEventListener("input", updateBench);
for (const id of ["opt-dir", "opt-shape", "opt-liga", "opt-mirror", "opt-strip"]) {
  $(id).addEventListener("change", updateBench);
}
benchInput.value = "مرحبا، 2024 is سنة جديدة!";

/* ---------- embedding levels ---------- */
const lvlInput = $<HTMLInputElement>("lvl-input");
const lvlStrip = $("lvl-strip");
const lvlDir = $("lvl-dir");

function updateLevels(): void {
  const text = lvlInput.value;
  const { levels, direction } = analyze(text);
  lvlStrip.replaceChildren();
  let i = 0;
  for (const ch of text) {
    const lv = levels[i] ?? 0;
    const cls = lv % 2 === 1 ? " rtl" : lv >= 2 ? " l2" : "";
    const cell = h("div", "lvl" + cls);
    const glyph = ch === " " ? "␣" : ch === "\n" ? "⏎" : ch;
    cell.append(h("span", "g", glyph));
    cell.append(h("span", "n", `${lv % 2 ? "←" : "→"} ${lv}`));
    lvlStrip.append(cell);
    i++;
  }
  lvlDir.textContent = `base: ${direction}`;
}
lvlInput.addEventListener("input", updateLevels);
lvlInput.value = "abc مرحبا 123 xyz";

/* ---------- contextual shaping specimen ---------- */
const SHAPE_LETTERS = ["ع", "ب", "ه", "ك", "م", "س"];
const TATWEEL = "ـ";
const shapeWrap = $("shape-letters");
const specimen = $("specimen");

function formsOf(letter: string): { name: string; g: string }[] {
  const at = (s: string, i: number): string => [...s][i] ?? letter;
  return [
    { name: "isolated", g: at(shape(letter), 0) },
    { name: "initial", g: at(shape(letter + TATWEEL), 0) },
    { name: "medial", g: at(shape(TATWEEL + letter + TATWEEL), 1) },
    { name: "final", g: at(shape(TATWEEL + letter), 1) },
  ];
}
function showSpecimen(letter: string): void {
  specimen.replaceChildren();
  for (const f of formsOf(letter)) {
    const cell = h("div", "form-cell");
    const g = h("div", "glyph", f.g);
    g.dir = "rtl";
    cell.append(g);
    cell.append(h("div", "name", f.name));
    const cp = (f.g.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0");
    cell.append(h("div", "cp", `U+${cp}`));
    specimen.append(cell);
  }
  [...shapeWrap.children].forEach((b) => b.classList.toggle("active", b.textContent === letter));
}
for (const letter of SHAPE_LETTERS) {
  const b = h("button", undefined, letter);
  b.setAttribute("lang", "ar");
  b.addEventListener("click", () => showSpecimen(letter));
  shapeWrap.append(b);
}

/* ---------- mirroring + embedded numbers ---------- */
const MIRROR = ["قائمة (أ) و [ب]", "الفاتورة رقم 1250 لسنة 1447"];
const mirrorWrap = $("mirror-rows");
function ltrOverride(el: HTMLElement): HTMLElement {
  el.dir = "ltr";
  el.style.unicodeBidi = "bidi-override";
  return el;
}
for (const src of MIRROR) {
  const row = h("div", "mirror-row");

  const naive = h("div");
  naive.append(h("span", "lbl", "✗ naive (raw, left-to-right)"));
  naive.append(document.createElement("br"));
  naive.append(ltrOverride(h("span", "draw", src)));

  const good = h("div");
  good.style.textAlign = "end";
  const lbl = h("span", "lbl", "✓ render()");
  lbl.style.color = "var(--green)";
  good.append(lbl);
  good.append(document.createElement("br"));
  good.append(ltrOverride(h("span", "draw", render(src))));

  row.append(naive, good);
  mirrorWrap.append(row);
}

/* ---------- copy buttons ---------- */
function wireCopy(btn: HTMLElement, getText: () => string): void {
  btn.addEventListener("click", () => {
    void navigator.clipboard?.writeText(getText()).then(() => {
      const prev = btn.textContent;
      btn.textContent = "Copied";
      btn.classList.add("done");
      window.setTimeout(() => {
        btn.textContent = prev;
        btn.classList.remove("done");
      }, 1400);
    });
  });
}
wireCopy($("copy-install"), () => "npm install bidi-shaper");
wireCopy($("bench-copy"), () => benchOut.textContent ?? "");

/* ---------- colophon ---------- */
$("colophon").textContent = `set in Fraunces, Amiri & Readex Pro · composed live by bidi-shaper · Unicode ${UNICODE_VERSION}`;

/* ---------- boot ---------- */
function boot(): void {
  setLoom(LOOM_SAMPLES[0] ?? "", true);
  loomTimer = window.setInterval(() => {
    if (loomTouched) {
      window.clearInterval(loomTimer);
      return;
    }
    loomI = (loomI + 1) % LOOM_SAMPLES.length;
    setLoom(LOOM_SAMPLES[loomI] ?? "", true);
  }, 3400);

  showProof();
  restartProof();
  updateBench();
  updateLevels();
  showSpecimen("ع");
}
boot();

// Arabic fonts change glyph metrics — redraw once they load.
document.fonts?.ready.then(() => {
  redrawAll();
  if (!loomTouched) buildLoom(loomInput.value, false);
});
let resizeTimer = 0;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    redrawAll();
    buildLoom(loomInput.value, false);
  }, 140);
});
