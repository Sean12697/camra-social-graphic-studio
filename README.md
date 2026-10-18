<p align="center"><img src="docs/assets/logo.svg" width="96" alt="CAMRA Social Graphics Studio icon"></p>

# CAMRA Social Graphics Studio

An unofficial, static, browser-based studio for making on-brand CAMRA social graphics. Nothing is uploaded. Made by Sean O'Mahoney, a CAMRA volunteer; not affiliated with or endorsed by CAMRA.

![Editor, dark theme](docs/screenshots/editor-dark.png)

## What it does

Pick one of 23 post types (or Custom), choose a branch, region or sub-brand logo from the built-in library of every CAMRA logo, add a photo or a decorative icon, then download every size you need: Instagram, Facebook, Twitter/X, Bluesky, LinkedIn, the CAMRA Events site and print. Designs can be saved, shared as links and backed up.

![Logo picker](docs/screenshots/logos-dark.png)

## Campaigns

The studio knows the national and annual campaigns branches post about: Mild Month, Cider and Perry Month, the Good Beer Guide launch, Members' Weekend, Cask Ale Week, Beer Day Britain and more, listed in [docs/CAMPAIGNS.md](docs/CAMPAIGNS.md). Before each one starts (two to six weeks ahead, depending on the campaign) a reminder appears under the top bar so there is time to schedule posts, and another appears while it is on. Each reminder opens the Campaigns panel, where every campaign has ready-made drafts (countdown, launch, last week, thank you) that open in the editor with your branch and default look, the dates and days to go already filled in.

Reminders can be snoozed, dismissed, muted per campaign, or limited to CAMRA campaigns, beer and pub days or national days in Settings. Turning on system notifications shows them as device notifications too; an installed copy in Chrome or Edge can also check while closed. Everything is worked out on the device from the bundled list.

The build publishes the same list as calendar feeds in `calendar/`: `campaigns.ics` (everything), `camra.ics` (CAMRA only) and `planning.ics` (a reminder on the day to start scheduling, for calendars such as Google that ignore alarms in subscribed feeds). Subscribe from the Campaigns panel and the calendar stays in sync with every redeploy. Set `SITE_URL` (for example `https://graphics.example.org/`) in the build environment to add a link back to each campaign's drafts in the events.

To add a campaign or confirm a year's dates, edit `src/core/data/campaigns.json` and run `npm run docs`.

## Quick start

```sh
npm install
npm run dev        # http://localhost:8080, rebuilds on change
npm run build      # static site in dist/
npm run check      # typecheck, lint, unit tests, docs check, build
npm run test:e2e   # Playwright (npx playwright install chromium first)
```

## Deploying on Cloudflare

Set the build command to `npm run build` and the output directory to `dist`. Node 22 is read from `.nvmrc`. `public/_headers` sets the CSP and caching, and serves the calendar feeds as `text/calendar`. Optionally set the `SITE_URL` environment variable to the site's address so calendar events link back to the studio.

## Architecture

```mermaid
flowchart LR
  core["src/core: templates, renderer, params, brand, campaigns, zip, backups"] --> ui["src/ui: editor, designs, campaigns, export, settings"]
  core --> sw["src/sw.ts: offline cache, background reminders"]
  ui --> store[("IndexedDB and localStorage")]
  sw --> store
  build["scripts/build.mjs"] --> dist["dist/ static site and calendar/*.ics"]
  core --> build
```

`src/core` has no DOM dependencies and is unit tested in Node. The query parameter reference is generated into [docs/QUERY_PARAMETERS.md](docs/QUERY_PARAMETERS.md) by `npm run docs` from the same schema the app uses.

## Logos

`assets/logos/catalogue.json` lists every branch, region and sub-brand logo with its id; [docs/LOGOS.md](docs/LOGOS.md) is the readable version. To add or replace logos, put white-on-transparent PNGs in a folder and run `python3 scripts/import-logos.py <branches|regions|sub-brands> <folder>`, then `npm run docs`. JPEGs are refused because they cannot be transparent.

## Data

Saved designs, the content library, the remembered logo and which reminders were dismissed live in this browser's IndexedDB; settings (including campaign reminder settings) in localStorage. Backups are ZIP files with `manifest.json`, `designs.json`, `library.json`, optional `prefs.json` and an `assets/` folder. `seeds/demo.json` holds the sample designs and `seeds/test.json` the edge-case fixtures used by the tests.

## Screenshots

Regenerate with `npm run build && npm run screenshots` (writes `docs/screenshots/`).
