# bidi-shaper demo

The interactive showcase for [bidi-shaper](https://github.com/cc1a2b/bidi-shaper). Every
Arabic/RTL string on the page is shaped and reordered **live in your browser** by the
library source in [`../src`](../src) (wired in through a Vite alias), so the demo always
exercises the current code and works before the package is on npm.

## Local development

```sh
cd demo
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in demo/dist
```

## Deploying to Vercel

The repo root carries a [`vercel.json`](../vercel.json) that makes this zero-config:

1. Go to [vercel.com/new](https://vercel.com/new) and import `cc1a2b/bidi-shaper`.
2. Leave every setting at its default (the root `vercel.json` sets the install/build
   commands and the `demo/dist` output directory) and hit **Deploy**.

Any other static host works the same way: run `npm run build` in `demo/` and serve
`demo/dist`.
