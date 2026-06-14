import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'adapters/jspdf': 'src/adapters/jspdf.ts',
    'adapters/pdfmake': 'src/adapters/pdfmake.ts',
    'adapters/pdfkit': 'src/adapters/pdfkit.ts',
    'adapters/canvas': 'src/adapters/canvas.ts',
    'adapters/three': 'src/adapters/three.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // Keep adapters as their own chunks so the core never pulls them in.
  splitting: false,
  minify: false,
  target: 'es2020',
  outDir: 'dist',
});
