# Security Policy

## Supported versions

The latest published version on npm receives security fixes. bidi-shaper has
**zero runtime dependencies** and does no I/O, network, or filesystem access —
it is a pure string-in / string-out transform — so the supply-chain and runtime
attack surface for consumers is minimal.

| Version | Supported |
|---------|-----------|
| latest (0.1.x) | ✅ |
| older          | ❌ |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

- Preferred: use GitHub's **private vulnerability reporting** — go to the
  repository's **Security** tab → **Report a vulnerability**.
- Alternatively, email the maintainer at the address listed in
  [`package.json`](./package.json) (`author` field).

Please include: affected version, a description, and a minimal reproduction
(the input string and options). You'll get an acknowledgement as soon as
possible, and a fix or mitigation will be released promptly once confirmed.

## What counts as a vulnerability

Because bidi-shaper only transforms text, the realistic concerns are:

- **Denial of service** — an input that causes pathological time/memory
  (e.g. quadratic blow-up) rather than the expected near-linear processing.
- **Incorrect output that crosses a trust boundary** — output that could
  smuggle control characters or otherwise mislead a downstream consumer.

Plain "this string reorders/shapes differently than I expected" is a
**correctness** issue, not a security one — please file those as a normal
[bug report](https://github.com/cc1a2b/bidi-shaper/issues), ideally with the
relevant UAX #9 rule or Unicode test case.

Thank you for helping keep bidi-shaper and its users safe.
