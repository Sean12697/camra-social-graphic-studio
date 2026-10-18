<p align="center"><img src="docs/assets/logo.svg" width="96" alt="CAMRA Social Graphics Studio icon"></p>

# CAMRA Social Graphics Studio

An unofficial, static, browser-based studio for making on-brand CAMRA social graphics. Nothing is uploaded. Made by Sean O'Mahoney, a CAMRA volunteer; not affiliated with or endorsed by CAMRA.

![Editor, dark theme](docs/screenshots/editor-dark.png)

## What it does

Pick one of 22 post types (or Custom), choose a branch, region or sub-brand logo from the built-in library of every CAMRA logo, add a photo or a decorative icon, then download every size you need: Instagram, Facebook, Twitter/X, Bluesky, LinkedIn, the CAMRA Events site and print. Designs can be saved, shared as links and backed up.

![Logo picker](docs/screenshots/logos-dark.png)

## Quick start

```sh
npm install
npm run dev        # http://localhost:8080, rebuilds on change
npm run build      # static site in dist/
npm run check      # typecheck, lint, unit tests, docs check, build
npm run test:e2e   # Playwright (npx playwright install chromium first)
```

## Deploying on Cloudflare

Set the build command to `npm run build` and the output directory to `dist`. Node 22 is read from `.nvmrc`. `public/_headers` sets the CSP and caching.

## Architecture

```mermaid
flowchart LR
  core["src/core: templates, renderer, params, brand, zip, backups"] --> ui["src/ui: editor, designs, export, settings"]
  ui --> store[("IndexedDB and localStorage")]
  build["scripts/build.mjs"] --> dist["dist/ static site"]
```

`src/core` has no DOM dependencies and is unit tested in Node. The query parameter reference is generated into [docs/QUERY_PARAMETERS.md](docs/QUERY_PARAMETERS.md) by `npm run docs` from the same schema the app uses.

## Logos

`assets/logos/catalogue.json` lists every branch, region and sub-brand logo with its id; [docs/LOGOS.md](docs/LOGOS.md) is the readable version. To add or replace logos, put white-on-transparent PNGs in a folder and run `python3 scripts/import-logos.py <branches|regions|sub-brands> <folder>`, then `npm run docs`. JPEGs are refused because they cannot be transparent.

## Data

Saved designs, the content library and the remembered logo live in this browser's IndexedDB; settings in localStorage. Backups are ZIP files with `manifest.json`, `designs.json`, `library.json`, optional `prefs.json` and an `assets/` folder. `seeds/demo.json` holds the sample designs and `seeds/test.json` the edge-case fixtures used by the tests.

## Screenshots

Regenerate with `npm run build && npm run screenshots` (writes `docs/screenshots/`).
