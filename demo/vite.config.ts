import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The demo runs against the library source in ../src, so it works before the
// package is on npm and always shows the current code. The alias keeps demo
// imports identical to what real users write: `import { render } from "bidi-shaper"`.
const lib = (p: string) => fileURLToPath(new URL(`../src/${p}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [{ find: /^bidi-shaper$/, replacement: lib("index.ts") }],
  },
  server: {
    fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] },
  },
  build: { target: "es2020" },
});
