# Changelog

All notable changes to VaultDex are documented here.

---

## [1.2.7] — 2026-06-03

### Fixed
- **Clicking a moved or renamed note no longer silently fails.** If VaultDex's index has a stale path (e.g. you reorganized your vault after the last index build), it now falls back to locating the note by filename. If the note genuinely can't be found, a clear notice is shown prompting you to reload VaultDex. Previously the click just did nothing with no feedback.

### Added
- **Path tooltip on result titles.** Hovering over a result title now shows the full vault path in a tooltip — useful when multiple notes share a similar title.

### Changed
- **Results page now uses your theme's accent color.** All hardcoded purple (`#660099`) has been replaced with Obsidian CSS variables (`--interactive-accent`, `--tag-color`, `--tag-background`, etc.). The header, divider rule, sidebar headings, result count, active sort button, and tag chips all now inherit your theme's accent color automatically. VaultDex adapts to light and dark themes without any manual configuration.

---

## [1.2.6] — 2026-05-14

- Fixed input field rendering as full-width block instead of text box on initial load

## [1.2.5] — 2026-04-28

- Added `folder:` search operator to scope results to a specific vault folder
- Added phrase search support with quoted strings

## [1.2.4] — 2026-04-15

- Added PARA category sidebar filter
- Added Relevance / Newest sort toggle

## [1.2.3] — 2026-04-01

- Initial community plugin release
