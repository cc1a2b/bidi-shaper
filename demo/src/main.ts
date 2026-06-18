import "./style.css";
import { render, analyze, shape, UNICODE_VERSION, type RenderOptions } from "bidi-shaper";

/* ----------------------------------------------------------------
   bidi-shaper demo — every glyph on this page is placed by the
   library source in ../src. The two passes (Arabic shaping + UAX #9
   reordering) run live in your browser; nothing here is precomputed.
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
const disp = (ch: string): string => (ch === " " ? "␣" : ch === "\n" ? "⏎" : ch === "\t" ? "⇥" : ch);
const isPresentationForm = (cp: number): boolean =>
  (cp >= 0xfb50 && cp <= 0xfdff) || (cp >= 0xfe70 && cp <= 0xfeff);

/* ================================================================
   HERO — kinetic shaping specimen.
   One word, toggled between contextually-joined and isolated
   (forced apart with ZWNJ) so the eye can see what shaping does.
   ================================================================ */
const KW_JOINED = "الكتابة";
const KW_BROKEN = [...KW_JOINED].join("‌"); // ZWNJ between letters → isolated forms
const kw = $("kw");
const kwState = $("kw-state");
const kwNote = $("kw-note");
let kwJoined = true;

function paintKW(): void {
  kw.textContent = kwJoined ? KW_JOINED : KW_BROKEN;
  kw.classList.toggle("raw", !kwJoined);
  kwState.textContent = kwJoined ? "shaped" : "raw";
  kwState.classList.toggle("raw", !kwJoined);
  kwNote.textContent = kwJoined ? "joined by context" : "isolated forms";
}

/* ================================================================
   THE PIPELINE THEATER — the signature element.
   The same line shown at three stations: STORED (logical) →
   SHAPED (shape(), still logical) → DRAWN (render(), visual order).
   Every tile keeps its stored index, so you can trace where each
   code point lands. Coloured by embedding level from analyze().
   ================================================================ */
const PIPE_SAMPLES = ["مرحبا 2024", "سعر 250 ريال", "Hello مرحبا!", "قائمة (أ)", "ولا أحد"];

const pipeInput = $<HTMLInputElement>("pipe-input");
const pipeSamples = $("pipe-samples");
const pipeDir = $("pipe-dir");
const pipePlay = $("pipe-play");
const stations = $("stations");
const stStored = $("stage-stored");
const stShaped = $("stage-shaped");
const stDrawn = $("stage-drawn");

let pipeI = 0;
let pipeTimer = 0;
let pipeTouched = false;

interface ChipOpts {
  cls?: string;
  li?: number;
  vi?: number;
  idx?: number;
  d?: number | null;
}
function makeChip(glyph: string, o: ChipOpts): HTMLElement {
  const c = h("div", "chip" + (o.cls ? " " + o.cls : ""));
  c.dir = "ltr";
  if (o.d != null) c.style.setProperty("--d", o.d.toFixed(3) + "s");
  if (o.li != null) c.dataset.li = String(o.li);
  if (o.vi != null) c.dataset.vi = String(o.vi);
  c.append(h("span", "chip-g", glyph));
  if (o.idx != null) c.append(h("span", "chip-i", String(o.idx)));
  return c;
}

function buildPipeline(input: string, animate: boolean): void {
  const a = analyze(input);
  const stored = [...input];
  const shaped = [...shape(input)];
  const drawn = [...a.text];

  pipeDir.innerHTML = stored.length
    ? `base <b>${a.direction}</b> · ${stored.length}&#8201;→&#8201;${drawn.length} glyphs`
    : "";

  stStored.replaceChildren();
  stShaped.replaceChildren();
  stDrawn.replaceChildren();
  if (stored.length === 0) return;

  stored.forEach((ch, i) => {
    const lv = a.levels[i] ?? 0;
    const removed = (a.logicalToVisual[i] ?? -1) < 0;
    const cls = (lv % 2 ? "rtl" : "ltr") + (removed ? " gone" : "");
    stStored.append(makeChip(disp(ch), { cls, li: i, idx: i, d: animate ? i * 0.025 : null }));
  });

  shaped.forEach((ch, i) => {
    const cp = ch.codePointAt(0) ?? 0;
    const cls = "shaped" + (isPresentationForm(cp) ? " joined" : "");
    stShaped.append(makeChip(disp(ch), { cls, d: animate ? 0.2 + i * 0.025 : null }));
  });

  drawn.forEach((ch, v) => {
    const li = a.visualToLogical[v] ?? 0;
    const lv = a.levels[li] ?? 0;
    const cls = "drawn " + (lv % 2 ? "rtl" : "ltr");
    stDrawn.append(makeChip(disp(ch), { cls, li, vi: v, idx: li, d: animate ? 0.42 + v * 0.025 : null }));
  });

  wirePipeHover();
  if (animate) {
    stations.classList.remove("run");
    void stations.offsetWidth; // reflow so the animation restarts
    stations.classList.add("run");
  } else {
    stations.classList.remove("run");
  }
}

function clearTrace(): void {
  stStored.classList.remove("tracing");
  stDrawn.classList.remove("tracing");
  stations.querySelectorAll(".chip.hot").forEach((c) => c.classList.remove("hot"));
}
function wirePipeHover(): void {
  const traceable = stations.querySelectorAll<HTMLElement>(".chip[data-li]");
  traceable.forEach((c) => {
    c.addEventListener("mouseenter", () => {
      const li = c.dataset.li;
      stStored.classList.add("tracing");
      stDrawn.classList.add("tracing");
      traceable.forEach((o) => o.classList.toggle("hot", o.dataset.li === li));
    });
  });
}
stations.addEventListener("mouseleave", clearTrace);

function setPipe(text: string, animate: boolean): void {
  pipeInput.value = text;
  buildPipeline(text, animate);
  [...pipeSamples.children].forEach((b) => b.classList.toggle("active", b.textContent === text));
}
function touchPipe(): void {
  if (pipeTouched) return;
  pipeTouched = true;
  window.clearInterval(pipeTimer);
}

for (const s of PIPE_SAMPLES) {
  const b = h("button", undefined, s);
  b.setAttribute("dir", "auto");
  b.addEventListener("click", () => {
    touchPipe();
    setPipe(s, true);
  });
  pipeSamples.append(b);
}
pipeInput.addEventListener("input", () => {
  touchPipe();
  buildPipeline(pipeInput.value, false);
  [...pipeSamples.children].forEach((b) => b.classList.remove("active"));
});
pipeInput.addEventListener("focus", touchPipe);
pipePlay.addEventListener("click", () => {
  touchPipe();
  buildPipeline(pipeInput.value, true);
});

/* ---------- canvas: draw each code point left-to-right ----------
   Exactly how a shaping-unaware, bidi-unaware renderer behaves:
   one glyph after another. Raw string → broken. render(string) →
   correct, because the string is already shaped and in visual order. */
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
const PROOF_INK = "#f0ebdd";
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

/* ---------- the workbench: compositor ---------- */
const INK = "#16140f";
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
    cell.append(h("span", "g", disp(ch)));
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
  naive.append(h("span", "lbl", "✗ naive · forced left-to-right"));
  naive.append(ltrOverride(h("span", "draw", src)));

  const good = h("div");
  good.style.textAlign = "end";
  const lbl = h("span", "lbl", "✓ render()");
  lbl.style.color = "var(--green)";
  good.append(lbl);
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
  `set in Fraunces, Space Grotesk, Amiri & Reem Kufi · composed live by bidi-shaper · Unicode ${UNICODE_VERSION}`;

/* ---------- boot ---------- */
function boot(): void {
  paintKW();
  window.setInterval(() => {
    kwJoined = !kwJoined;
    paintKW();
  }, 2300);

  setPipe(PIPE_SAMPLES[0] ?? "", true);
  pipeTimer = window.setInterval(() => {
    if (pipeTouched) {
      window.clearInterval(pipeTimer);
      return;
    }
    pipeI = (pipeI + 1) % PIPE_SAMPLES.length;
    setPipe(PIPE_SAMPLES[pipeI] ?? "", true);
  }, 3600);

  showProof();
  restartProof();
  updateBench();
  updateLevels();
  showSpecimen("ع");
}
boot();

// Arabic fonts change glyph metrics — redraw the canvases once they load.
document.fonts?.ready.then(() => {
  redrawAll();
  if (!pipeTouched) buildPipeline(pipeInput.value, false);
});
let resizeTimer = 0;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(redrawAll, 140);
});
