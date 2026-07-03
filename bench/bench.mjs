// Benchmarks: bidi-shaper vs bidi-js (levels + reorder; bidi-js does not shape).
// Run `npm run build` first, then `npm run bench`.
import { Bench } from 'tinybench';
import bidiFactoryModule from 'bidi-js';
import { render, reorder, getEmbeddingLevels } from '../dist/index.js';

const bidiFactory = bidiFactoryModule.default ?? bidiFactoryModule;
const bidi = bidiFactory();

const TEXTS = {
  'ascii sentence (61 ch)': 'The quick brown fox jumps over the lazy dog, twice a day...',
  'mixed LTR/RTL (40 ch)': 'The title is "مفتاح المعاني" in Arabic.',
  'persian + numbers (21 ch)': 'قیمت هر واحد 123.45 ﷼',
  'arabic paragraph (612 ch)':
    'مرحبا بالعالم، هذا نص تجريبي طويل يحتوي على أرقام مثل 123 وكلمات إنجليزية مثل test وعلامات (أقواس) للقياس. '.repeat(6).trim(),
};

for (const [label, text] of Object.entries(TEXTS)) {
  const bench = new Bench({ time: 250 });

  bench
    .add('bidi-shaper render() — shape + reorder', () => {
      render(text);
    })
    .add('bidi-shaper reorder() — no shaping', () => {
      reorder(text);
    })
    .add('bidi-shaper getEmbeddingLevels()', () => {
      getEmbeddingLevels(text);
    })
    .add('bidi-js getEmbeddingLevels()', () => {
      bidi.getEmbeddingLevels(text, 'auto');
    })
    .add('bidi-js levels + getReorderedString()', () => {
      const levels = bidi.getEmbeddingLevels(text, 'auto');
      bidi.getReorderedString(text, levels);
    });

  await bench.run();

  console.log(`\n## ${label}`);
  console.table(
    bench.tasks.map((t) => ({
      name: t.name,
      'ops/sec': Math.round(t.result?.throughput?.mean ?? 0).toLocaleString('en-US'),
      'mean (µs)': ((t.result?.latency?.mean ?? 0) * 1000).toFixed(2),
    })),
  );
}
