import "./style.css";
import { render, analyze, shape, UNICODE_VERSION, type RenderOptions } from "bidi-shaper";

/* ----------------------------------------------------------------
   bidi-shaper demo — "THE INSTRUMENT"
   Everything on this page is computed live by the library source in
   ../src. The signature piece is the instrument: it takes your text
   and steps through the actual algorithm — shape, level, reorder
   (the real L2 cascade, highest level first), mirror — then hands
   back the flat visual-order string a renderer can draw. Nothing is
   precomputed; nothing is faked.
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
const cp = (s: string): string[] => [...s];

/* ================================================================
   THE INSTRUMENT
   ================================================================ */
const SVGNS = "http://www.w3.org/2000/svg";
const INST_MAX = 26;
const BEAT = 620; // ms per cascade reversal step

const PHASES = [
  { id: "stored", label: "stored" },
  { id: "shape", label: "shaped" },
  { id: "level", label: "leveled" },
  { id: "reorder", label: "reordered" },
  { id: "mirror", label: "mirrored" },
  { id: "drawn", label: "drawn" },
] as const;

const RULES: Record<string, string> = {
  stored:
    '<span class="ph">STORED</span> · logical order — the code points exactly as you keep them in memory, in reading order. <span class="ref">Nothing has run yet.</span>',
  shape:
    '<span class="ph">SHAPED</span> · each Arabic letter takes its contextual form, and lam-alef pairs fuse into one ligature. <span class="ref">Unicode core spec §9.2 — in logical order, before reordering.</span>',
  level:
    '<span class="ph">LEVELED</span> · every code point gets an embedding level: <b class="ltr">even = left-to-right</b>, <b class="rtl">odd = right-to-left</b>. <span class="ref">UAX&nbsp;#9 rules X1–I2.</span>',
  reorder:
    '<span class="ph">REORDERED</span> · contiguous runs are reversed from the highest level down to the lowest — the deepest runs flip first. <span class="ref">UAX&nbsp;#9 rule L2.</span>',
  mirror:
    '<span class="ph">MIRRORED</span> · paired glyphs — brackets, parentheses — are swapped for their mirror on right-to-left runs. <span class="ref">UAX&nbsp;#9 rule L4.</span>',
  drawn:
    '<span class="ph">DRAWN</span> · a flat string in visual order. Paint it left-to-right, glyph by glyph, and it reads right. <span class="ref">This is what render() returns.</span>',
};

const INST_SAMPLES = ["مرحبا 2026", "سعر 250 ريال", "Hello مرحبا", "قائمة (أ)", "سنة ١٤٤٧"];

interface Model {
  n: number;
  raw: string[];
  shaped: string[];
  final: string[];
  level: number[];
  removed: boolean[];
  logicalToVisual: number[];
  visualToLogical: number[];
  maxLevel: number;
  direction: string;
  finalText: string;
  m: number;
  frames: number[][];
  activeLevels: number[];
}

const instStage = $("inst-stage");
const instInput = $<HTMLInputElement>("inst-input");
const instRule = $("inst-rule");
const phaseRail = $("phase-rail");
const instSamplesWrap = $("inst-samples");
const instTape = $<HTMLCanvasElement>("inst-tape");
const mDir = $("m-dir");
const mGlyphs = $("m-glyphs");
const mLevel = $("m-level");

let model: Model | null = null;
let phaseIndex = 0;
let chipEls: { g: SVGGElement; glyph: SVGTextElement; i: number }[] = [];
let geom = { padX: 26, capH: 14, stepH: 28, tileH: 40, gap: 8, bottom: 22, cellW: 48, maxLevel: 0 };
let gen = 0;
let playing = false;
let playTimer = 0;

function buildModel(text: string): Model {
  let cps = cp(text);
  if (cps.length > INST_MAX) cps = cps.slice(0, INST_MAX);
  const s = cps.join("");
  const n = cps.length;

  const aMir = analyze(s);
  const aNo = analyze(s, { mirror: false });
  const visMir = cp(aMir.text);
  const visNo = cp(aNo.text);

  const raw = cps.slice();
  const shaped: string[] = new Array(n);
  const final: string[] = new Array(n);
  const level: number[] = new Array(n);
  const removed: boolean[] = new Array(n);
  const logicalToVisual: number[] = new Array(n);
  let maxLevel = 0;

  for (let i = 0; i < n; i++) {
    const v = aMir.logicalToVisual[i] ?? -1;
    logicalToVisual[i] = v;
    removed[i] = v < 0;
    level[i] = aMir.levels[i] ?? 0;
    if (!removed[i]) maxLevel = Math.max(maxLevel, level[i]!);
    shaped[i] = removed[i] ? raw[i]! : visNo[v] ?? raw[i]!;
    final[i] = removed[i] ? raw[i]! : visMir[v] ?? raw[i]!;
  }

  const visualToLogical = aMir.visualToLogical.slice();
  const { frames, activeLevels } = buildCascade(n, level, removed, visualToLogical);

  return {
    n, raw, shaped, final, level, removed, logicalToVisual, visualToLogical,
    maxLevel, direction: aMir.direction, finalText: aMir.text, m: visMir.length,
    frames, activeLevels,
  };
}

/** Reproduce UAX #9 rule L2 as a sequence of frames: reverse maximal runs at
 *  level ≥ L for L from the highest level down to 1. Each frame is the retained
 *  logical indices in their order at that step. */
function buildCascade(
  n: number, level: number[], removed: boolean[], visualToLogical: number[],
): { frames: number[][]; activeLevels: number[] } {
  const R: number[] = [];
  for (let i = 0; i < n; i++) if (!removed[i]) R.push(i);
  let maxLv = 0;
  for (const i of R) maxLv = Math.max(maxLv, level[i]!);

  const frames: number[][] = [R.slice()];
  const activeLevels: number[] = [];
  let curr = R.slice();

  for (let L = maxLv; L >= 1; L--) {
    const next = curr.slice();
    let i = 0;
    while (i < next.length) {
      if (level[next[i]!]! >= L) {
        let j = i;
        while (j + 1 < next.length && level[next[j + 1]!]! >= L) j++;
        for (let a = i, b = j; a < b; a++, b--) {
          const t = next[a]!; next[a] = next[b]!; next[b] = t;
        }
        i = j + 1;
      } else i++;
    }
    if (next.join(",") !== curr.join(",")) {
      frames.push(next.slice());
      activeLevels.push(L);
    }
    curr = next;
  }

  // Trust analyze() as the source of truth: if our cascade didn't land on the
  // library's visual order (an edge we don't animate stepwise), fall back to a
  // single clean tween so it can never look wrong.
  if (curr.join(",") !== visualToLogical.join(",")) {
    return { frames: [R.slice(), visualToLogical.slice()], activeLevels: [1] };
  }
  return { frames, activeLevels };
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVGNS, tag);
  for (const k in attrs) el.setAttribute(k, String(attrs[k]));
  return el;
}

function colorClass(lv: number): string {
  if (lv >= 2) return "deep";
  return lv % 2 === 1 ? "odd" : "even";
}

function buildStage(): void {
  chipEls = [];
  instStage.innerHTML = "";
  if (!model || model.n === 0) {
    instStage.innerHTML = `<svg class="inst-svg" height="80" viewBox="0 0 320 80"><text x="14" y="44" class="axis-cap">awaiting input…</text></svg>`;
    return;
  }
  const m = model;
  const cols = Math.max(m.n, m.m, 1);
  const availW = instStage.clientWidth || 900;
  const padX = m.maxLevel >= 1 ? 28 : 10;
  const cellW = Math.max(34, Math.min(54, Math.floor((availW - padX - 8) / cols)));
  const { capH, stepH, tileH, bottom } = geom;
  const totalW = padX + cols * cellW + 6;
  const svgH = capH + m.maxLevel * stepH + tileH + bottom;
  geom = { ...geom, padX, cellW, maxLevel: m.maxLevel };

  const svg = svgEl("svg", {
    class: "inst-svg", width: totalW, height: svgH,
    viewBox: `0 0 ${totalW} ${svgH}`, role: "img",
    "aria-label": "the bidi pipeline, one phase at a time",
  });

  // level ruler
  if (m.maxLevel >= 1) {
    for (let L = 0; L <= m.maxLevel; L++) {
      const y = capH + (m.maxLevel - L) * stepH + tileH / 2;
      svg.appendChild(svgEl("line", { class: L === 0 ? "axis-line zero" : "axis-line", x1: padX, y1: y, x2: totalW - 4, y2: y }));
      const lbl = svgEl("text", { class: "axis-label", x: 4, y: y + 3 });
      lbl.textContent = `L${L}`;
      svg.appendChild(lbl);
    }
  }

  // chips — one per input code point, created once, then animated by transform
  for (let i = 0; i < m.n; i++) {
    const g = svgEl("g", { class: "chip", "data-i": i });
    const bw = cellW - geom.gap;
    g.appendChild(svgEl("rect", { class: "chip-box", x: geom.gap / 2, y: 0, width: bw, height: tileH, rx: 5 }));
    g.appendChild(svgEl("rect", { class: "chip-rail", x: geom.gap / 2, y: tileH - 3, width: bw, height: 3, rx: 1.5 }));
    const glyph = svgEl("text", { class: "chip-glyph", x: cellW / 2, y: tileH / 2 });
    glyph.textContent = m.raw[i]!;
    g.appendChild(glyph);
    const idx = svgEl("text", { class: "chip-idx", x: cellW / 2, y: tileH + 13 });
    idx.textContent = String(i);
    g.appendChild(idx);
    svg.appendChild(g);
    chipEls.push({ g: g as SVGGElement, glyph: glyph as SVGTextElement, i });
  }

  instStage.appendChild(svg);
}

function slotX(slot: number): number {
  return geom.padX + slot * geom.cellW;
}
function levelY(lv: number, stepped: boolean): number {
  const base = geom.capH + (stepped ? geom.maxLevel - lv : geom.maxLevel) * geom.stepH;
  return base;
}

/** Static layout for a phase (final positions; the cascade overrides x). */
function applyPhase(idx: number): void {
  if (!model) return;
  const m = model;
  const id = PHASES[idx]!.id;
  const colored = id === "level" || id === "reorder" || id === "mirror" || id === "drawn";
  const stepped = id === "level" || id === "reorder" || id === "mirror";
  const glyphSet = id === "stored" ? m.raw : id === "mirror" || id === "drawn" ? m.final : m.shaped;
  const visualX = id === "reorder" || id === "mirror" || id === "drawn";

  for (const { g, glyph, i } of chipEls) {
    const rm = m.removed[i]!;
    const slot = visualX ? m.logicalToVisual[i]! : i;
    const x = slotX(slot < 0 ? i : slot);
    const y = levelY(stepped ? m.level[i]! : 0, stepped);
    g.style.transform = `translate(${x}px, ${y}px)`;

    let op = "1";
    if (rm) op = id === "stored" ? "1" : id === "shape" ? "0.16" : "0";
    g.style.opacity = op;

    const cls = rm
      ? "chip removed"
      : colored
        ? `chip ${colorClass(m.level[i]!)}`
        : "chip neutral";
    g.setAttribute("class", cls);
    glyph.textContent = glyphSet[i]!;
  }
}

/** Animate the L2 cascade across the reorder frames, deepest runs first. */
function runCascade(myGen: number): void {
  if (!model) return;
  const m = model;
  m.frames.forEach((frame, k) => {
    const fire = () => {
      if (gen !== myGen) return;
      const pos = new Map<number, number>();
      frame.forEach((idx, slot) => pos.set(idx, slot));
      for (const { g, i } of chipEls) {
        if (m.removed[i]) continue;
        const slot = pos.get(i) ?? m.logicalToVisual[i]!;
        const y = levelY(m.level[i]!, true);
        g.style.transform = `translate(${slotX(slot)}px, ${y}px)`;
      }
      // pulse the run(s) being reversed at this step
      const L = m.activeLevels[k - 1];
      for (const { g, i } of chipEls) {
        const hot = k > 0 && L != null && !m.removed[i] && m.level[i]! >= L;
        g.classList.toggle("hot", hot);
      }
      if (k === m.frames.length - 1) {
        window.setTimeout(() => { if (gen === myGen) chipEls.forEach(({ g }) => g.classList.remove("hot")); }, BEAT * 0.7);
      }
    };
    if (k === 0) fire();
    else window.setTimeout(fire, k * BEAT);
  });
}

function pulseFlip(myGen: number): void {
  if (!model) return;
  const m = model;
  for (const { g, i } of chipEls) {
    if (!m.removed[i] && m.shaped[i] !== m.final[i]) {
      g.classList.add("flip");
      window.setTimeout(() => { if (gen === myGen) g.classList.remove("flip"); }, 720);
    }
  }
}

function updateRail(idx: number): void {
  [...phaseRail.children].forEach((el, i) => {
    el.classList.toggle("active", i === idx);
    el.classList.toggle("done", i < idx);
  });
}

function gotoPhase(idx: number, opts: { cascade?: boolean } = {}): void {
  if (!model) return;
  gen++;
  const myGen = gen;
  phaseIndex = idx;
  updateRail(idx);
  instRule.innerHTML = RULES[PHASES[idx]!.id]!;
  applyPhase(idx);
  if (PHASES[idx]!.id === "reorder" && opts.cascade && model.frames.length > 2) runCascade(myGen);
  if (PHASES[idx]!.id === "mirror") pulseFlip(myGen);
}

function stopPlay(): void {
  playing = false;
  window.clearTimeout(playTimer);
  $("tp-play").textContent = "▶";
}

function play(): void {
  if (!model || model.n === 0) return;
  if (playing) { stopPlay(); return; }
  playing = true;
  $("tp-play").textContent = "❚❚";
  let i = 0;
  const step = (): void => {
    if (!playing) return;
    gotoPhase(i, { cascade: true });
    const dwell =
      PHASES[i]!.id === "reorder" ? model!.frames.length * BEAT + 650 : 1100;
    i++;
    if (i < PHASES.length) playTimer = window.setTimeout(step, dwell);
    else playTimer = window.setTimeout(stopPlay, 900);
  };
  step();
}

function drawTape(): void {
  if (!model) return;
  drawNaive(instTape, model.finalText, "#f3ecdd", 30, '30px Amiri, "Noto Naskh Arabic", serif');
}

function setInstText(text: string, autoplay: boolean): void {
  stopPlay();
  instInput.value = text;
  model = buildModel(text);
  mDir.textContent = model.direction;
  mDir.className = model.direction === "rtl" ? "rtl" : "";
  mGlyphs.textContent = String(model.m);
  mLevel.textContent = String(model.maxLevel);
  buildStage();
  drawTape();
  [...instSamplesWrap.children].forEach((b) => b.classList.toggle("active", b.textContent === text));

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (autoplay && !reduce && model.n > 0) {
    gotoPhase(0);
    window.setTimeout(() => { if (!playing) play(); }, 420);
  } else {
    gotoPhase(model.n === 0 ? 0 : PHASES.length - 1);
  }
}

// build the phase rail
PHASES.forEach((p, i) => {
  const b = h("button", "phase-step");
  b.setAttribute("role", "tab");
  b.append(h("span", "n", `0${i + 1}`));
  b.append(h("span", "l", p.label));
  b.addEventListener("click", () => { stopPlay(); gotoPhase(i, { cascade: true }); });
  phaseRail.append(b);
});
for (const s of INST_SAMPLES) {
  const b = h("button", undefined, s);
  b.setAttribute("dir", "auto");
  b.addEventListener("click", () => setInstText(s, true));
  instSamplesWrap.append(b);
}
$("tp-play").addEventListener("click", play);
$("tp-prev").addEventListener("click", () => { stopPlay(); gotoPhase(Math.max(0, phaseIndex - 1), { cascade: true }); });
$("tp-next").addEventListener("click", () => { stopPlay(); gotoPhase(Math.min(PHASES.length - 1, phaseIndex + 1), { cascade: true }); });
instInput.addEventListener("input", () => setInstText(instInput.value, false));

/* ================================================================
   NAIVE RENDERER — draw each code point left-to-right, no shaping,
   no reordering. Exactly how jsPDF / a bitmap font / a plotter behaves.
   ================================================================ */
const canvasJobs = new Map<HTMLCanvasElement, { text: string; color: string; size: number; font: string }>();

function drawNaive(canvas: HTMLCanvasElement, text: string, color: string, size = 28, font = '28px Amiri, "Noto Naskh Arabic", serif'): void {
  canvasJobs.set(canvas, { text, color, size, font });
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 600;
  const hgt = canvas.clientHeight || 56;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.round(hgt * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, hgt);
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  let x = 12;
  const firstLine = text.split("\n")[0] ?? "";
  for (const ch of firstLine) {
    ctx.fillText(ch, x, hgt / 2 + 1);
    x += ctx.measureText(ch).width;
    if (x > w - 12) break;
  }
}
const redrawCanvases = (): void => {
  for (const [canvas, job] of canvasJobs) drawNaive(canvas, job.text, job.color, job.size, job.font);
};

/* ================================================================
   THE BENCH
   ================================================================ */
const INK = "#f3ecdd";
const BENCH_SAMPLES: [string, string][] = [
  ["Arabic", "مرحبا بالعالم"],
  ["Persian", "سلام دنیا ۱۲۳"],
  ["Urdu", "اردو میں خوش آمدید"],
  ["Mixed", 'The title is "مفتاح المعاني".'],
  ["Numbers", "الفاتورة 1250 ريال"],
  ["Tashkeel", "بِسْمِ اللَّهِ"],
];
const benchInput = $<HTMLTextAreaElement>("bench-input");
const benchRaw = $<HTMLCanvasElement>("bench-raw");
const benchFixed = $<HTMLCanvasElement>("bench-fixed");
const benchOut = $("bench-out");
const benchRouting = $("bench-routing");

function benchOptions(): RenderOptions {
  return {
    direction: $<HTMLSelectElement>("opt-dir").value as RenderOptions["direction"],
    shape: $<HTMLInputElement>("opt-shape").checked,
    ligatures: $<HTMLInputElement>("opt-liga").checked,
    mirror: $<HTMLInputElement>("opt-mirror").checked,
    tashkeel: $<HTMLInputElement>("opt-strip").checked ? "strip" : "keep",
  };
}

const ROUTE_MAX = 22;
function buildRouting(text: string, opts: RenderOptions): void {
  const a = analyze(text, opts);
  let logical = cp(text);
  if (logical.length > ROUTE_MAX) logical = logical.slice(0, ROUTE_MAX);
  const visual = cp(a.text).slice(0, ROUTE_MAX);
  const n = logical.length;
  const mm = visual.length;
  if (n === 0) { benchRouting.innerHTML = ""; return; }

  const cols = Math.max(n, mm, 1);
  const availW = benchRouting.clientWidth || 380;
  const cellW = Math.max(20, Math.min(34, Math.floor(availW / cols)));
  const padX = 2;
  const totalW = padX * 2 + cols * cellW;
  const boxH = 30, gap = 130, topY = 16, botY = topY + boxH + gap;
  const H = botY + boxH + 18;
  const cx = (c: number): number => padX + c * cellW + cellW / 2;

  const lines: string[] = [];
  const top: string[] = [];
  const bot: string[] = [];

  for (let i = 0; i < n; i++) {
    const v = a.logicalToVisual[i] ?? -1;
    const lv = a.levels[i] ?? 0;
    const color = v < 0 ? "var(--ink-faint)" : lv % 2 === 1 ? "var(--cyan)" : "var(--amber)";
    const bx = padX + i * cellW + 2;
    const bw = cellW - 4;
    top.push(
      `<g opacity="${v < 0 ? 0.32 : 1}"><rect class="route-box" x="${bx}" y="${topY}" width="${bw}" height="${boxH}" rx="4"/>` +
      `<text class="route-glyph" x="${cx(i)}" y="${topY + boxH / 2}">${escapeXml(logical[i] ?? "")}</text>` +
      `<text class="route-cell" x="${cx(i)}" y="${topY - 5}">${i}</text></g>`,
    );
    if (v >= 0 && v < mm) {
      const x1 = cx(i), y1 = topY + boxH, x2 = cx(v), y2 = botY;
      lines.push(`<path class="route-line" stroke="${color}" d="M${x1},${y1} C${x1},${y1 + gap * 0.5} ${x2},${y2 - gap * 0.5} ${x2},${y2}"/>`);
    }
  }
  for (let v = 0; v < mm; v++) {
    const i = a.visualToLogical[v] ?? 0;
    const lv = a.levels[i] ?? 0;
    const color = lv % 2 === 1 ? "var(--cyan)" : "var(--amber)";
    const bx = padX + v * cellW + 2;
    const bw = cellW - 4;
    bot.push(
      `<g><rect class="route-box" x="${bx}" y="${botY}" width="${bw}" height="${boxH}" rx="4" style="stroke:${color}"/>` +
      `<text class="route-glyph" x="${cx(v)}" y="${botY + boxH / 2}">${escapeXml(visual[v] ?? "")}</text>` +
      `<text class="route-cell" x="${cx(v)}" y="${botY + boxH + 11}" style="fill:${color}">${v}</text></g>`,
    );
  }

  benchRouting.innerHTML =
    `<svg class="routing-svg" width="${totalW}" height="${H}" viewBox="0 0 ${totalW} ${H}">` +
    `<text class="route-cap" x="${padX}" y="9">logical →</text>` +
    `<text class="route-cap" x="${padX}" y="${botY + boxH + 11}" text-anchor="start"> </text>` +
    lines.join("") + top.join("") + bot.join("") +
    `</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

function updateBench(): void {
  const opts = benchOptions();
  const out = render(benchInput.value, opts);
  drawNaive(benchRaw, benchInput.value, INK);
  drawNaive(benchFixed, out, INK);
  benchOut.textContent = out || " ";
  buildRouting(benchInput.value, opts);
}

const benchSampleWrap = $("bench-samples");
for (const [label, text] of BENCH_SAMPLES) {
  const b = h("button", undefined, label);
  b.addEventListener("click", () => { benchInput.value = text; updateBench(); });
  benchSampleWrap.append(b);
}
benchInput.addEventListener("input", updateBench);
for (const id of ["opt-dir", "opt-shape", "opt-liga", "opt-mirror", "opt-strip"]) {
  $(id).addEventListener("change", updateBench);
}
benchInput.value = "مرحبا، 2026 is سنة جديدة!";

/* ================================================================
   CONTEXTUAL SHAPING SPECIMEN
   ================================================================ */
const SHAPE_LETTERS = ["ع", "ب", "ه", "ك", "م", "س", "ی"];
const TATWEEL = "ـ";
const shapeWrap = $("shape-letters");
const specimen = $("specimen");

function formsOf(letter: string): { name: string; g: string }[] {
  const at = (s: string, i: number): string => cp(s)[i] ?? letter;
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
    const code = (f.g.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0");
    cell.append(h("div", "cp", `U+${code}`));
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

/* ================================================================
   COPY · colophon · boot
   ================================================================ */
function wireCopy(btn: HTMLElement, getText: () => string): void {
  btn.addEventListener("click", () => {
    void navigator.clipboard?.writeText(getText()).then(() => {
      const prev = btn.textContent;
      btn.textContent = "copied";
      btn.classList.add("done");
      window.setTimeout(() => { btn.textContent = prev; btn.classList.remove("done"); }, 1400);
    });
  });
}
wireCopy($("copy-install"), () => "npm install bidi-shaper");
wireCopy($("bench-copy"), () => benchOut.textContent ?? "");

$("r-uver").textContent = UNICODE_VERSION;
$("colophon").textContent = `set in Space Grotesk · JetBrains Mono · Amiri — composed live by bidi-shaper · Unicode ${UNICODE_VERSION}`;

function boot(): void {
  setInstText(INST_SAMPLES[0]!, true);
  updateBench();
  showSpecimen("ع");
}
boot();

// Arabic fonts shift glyph metrics once loaded — redraw measured canvases.
document.fonts?.ready.then(() => {
  redrawCanvases();
  if (model && !playing) { buildStage(); applyPhase(phaseIndex); }
});

let resizeTimer = 0;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    redrawCanvases();
    if (model && !playing) { buildStage(); applyPhase(phaseIndex); }
    updateBench();
  }, 160);
});
