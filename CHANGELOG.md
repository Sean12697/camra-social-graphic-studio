# Changelog

## 2.2.0

### Added
- Build step (esbuild, TypeScript) producing a static `dist/` with hashed bundles, a generated service worker precache and generated PWA PNG icons.
- Saved designs: save, open, rename, duplicate, search, filter, sort, bulk select, delete with undo, Recently deleted with restore and purge, sample designs.
- Backups: export everything or a selection as a ZIP, import with a dry-run preview and merge, overwrite or copy modes.
- One-ZIP download option (automatic on iOS for several sizes), `zip=1` parameter, copy image, generated alt text, export progress.
- Settings: dark, light or system theme; personal default look; download format; storage usage; clear all data.
- Unit tests (node:test), Playwright browser tests with axe checks in both themes, CI, generated `docs/QUERY_PARAMETERS.md`, security headers.

### Changed
- Form grouped into collapsible sections; toasts replace inline notices; tips walkthrough traps focus; storage moved to IndexedDB with automatic migration.

### Fixed
- Unknown `tagline` values no longer silently hide the tagline; share links work from file pages; unticking Remember logo now forgets it; unknown dropdown values in links no longer blank the control.
