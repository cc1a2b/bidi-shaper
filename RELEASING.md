# Releasing

Maintainer checklist for publishing `bidi-shaper` to npm.

## One-time setup (before the first release)

1. **Create the GitHub repository** and point this clone at it:
   ```bash
   git remote add origin git@github.com:<owner>/bidi-shaper.git
   git push -u origin main
   ```
2. **Update the repo URLs in `package.json`** (`repository.url`, `homepage`, `bugs.url`)
   and the badge URLs at the top of `README.md` to the real `<owner>/bidi-shaper`.
   ⚠️ npm **provenance** (used by `.github/workflows/release.yml`) refuses to publish
   if `repository.url` doesn't match the repository CI runs from.
3. **npm account**: `npm login`, enable 2FA, then create an *automation* access token
   and save it as the `NPM_TOKEN` repository secret on GitHub.

## Each release

1. Make sure `main` is green (CI runs typecheck, lint, tests, build, bundle smoke test).
2. Move the `## [Unreleased]` notes in `CHANGELOG.md` under the new version heading with today's date.
3. Bump + tag + push:
   ```bash
   npm version <patch|minor|major>   # updates package.json, creates the vX.Y.Z tag
   git push origin main --follow-tags
   ```
4. The tag triggers `release.yml`, which re-runs all checks and publishes with
   `--provenance --access public` (`prepublishOnly` rebuilds `dist/`).

## Manual publish (fallback, no CI)

```bash
npm run typecheck && npm run lint && npm test
npm publish --access public      # prepublishOnly builds dist/
```

## Sanity checks before any publish

```bash
npm pack --dry-run    # inspect the file list — dist/ without sourcemaps, README, LICENSE, CHANGELOG
npm view bidi-shaper  # confirm the version you're about to publish doesn't already exist
```
