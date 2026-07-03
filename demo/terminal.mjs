// Quick terminal tour: node demo/terminal.mjs   (run `npm run build` first)
//
// Note: a real terminal emulator may apply its own bidi pass on top — the
// point of the table is the code-point order, which you can also see by
// piping through `hexdump` or printing in an editor.
import { render, analyze, shape, detectDirection, UNICODE_VERSION } from '../dist/index.js';

const samples = [
  'مرحبا بالعالم',
  'سلام دنیا',
  'The title is "مفتاح المعاني" in Arabic.',
  'قیمت: 123.45',
  'قائمة (أ) و [ب]',
];

console.log(`bidi-shaper demo — Unicode ${UNICODE_VERSION}\n`);
for (const s of samples) {
  const a = analyze(s);
  console.log(`logical   : ${s}`);
  console.log(`direction : ${detectDirection(s)}`);
  console.log(`shaped    : ${shape(s)}`);
  console.log(`visual    : ${render(s)}`);
  console.log(`levels    : ${Array.from(a.levels).join(' ')}`);
  console.log('');
}
