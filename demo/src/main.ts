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

/* ---------- canvas: draw each code point left-to-right ----------
   This is exactly how a shaping-unaware, bidi-unaware renderer behaves:
   one glyph after another. Feed it the raw string → broken. Feed it
   render(string) → correct, because the string is already shaped and
   in visual order. */
const INK = "#251f14";
const CANVAS_FONT = '30px Amiri, "Noto Naskh Arabic", "Segoe UI", serif';
const canvasJobs = new Map<HTMLCanvasElement, string>();

function drawNaive(canvas: HTMLCanvasElement, text: string): void {
  canvasJobs.set(canvas, text);
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 640;
  const hgt = 56;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.round(hgt * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, hgt);
  ctx.font = CANVAS_FONT;
  ctx.fillStyle = INK;
  ctx.textBaseline = "middle";
  let x = 6;
  const firstLine = text.split("\n")[0] ?? "";
  for (const ch of firstLine) {
    ctx.fillText(ch, x, hgt / 2 + 1);
    x += ctx.measureText(ch).width;
  }
}
const redrawAll = (): void => {
  for (const [canvas, text] of canvasJobs) drawNaive(canvas, text);
};

/* ---------- masthead galley ---------- */
const GALLEY = "خيرُ الكلامِ ما قلَّ ودلَّ";
$("galley-logical").textContent = GALLEY;
const galleyVisual = $("galley-visual");
galleyVisual.style.direction = "ltr";
galleyVisual.style.unicodeBidi = "bidi-override";
galleyVisual.textContent = render(GALLEY);

/* ---------- proof sheet (auto-cycling before/after) ---------- */
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
  const sample = PROOF[proofI]!;
  drawNaive(proofRaw, sample);
  drawNaive(proofFixed, render(sample));
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
  drawNaive(benchRaw, benchInput.value);
  drawNaive(benchFixed, out);
  benchOut.textContent = out || " ";
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
$("colophon").textContent =
  `set in Amiri & Readex Pro · composed live by bidi-shaper · Unicode ${UNICODE_VERSION}`;

/* ---------- boot ---------- */
function boot(): void {
  showProof();
  restartProof();
  updateBench();
  updateLevels();
  showSpecimen("ع");
}
boot();
// Arabic fonts change glyph metrics — redraw the canvases once they load.
document.fonts?.ready.then(redrawAll);
let resizeTimer = 0;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(redrawAll, 120);
});
