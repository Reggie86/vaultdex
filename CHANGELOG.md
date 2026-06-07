# Changelog

All notable changes to VaultDex are documented here.

---

## [1.2.18] — 2026-06-07

### Changed
- Default max results raised from 25 to 50
- Setting max results to **0** now means no limit — returns all matching results; useful for folder-scoped searches where you want everything

---

## [1.2.17] — 2026-06-07

### Changed
- Default max results raised from 25 to 50 (superseded by 1.2.18)

---

## [1.2.16] — 2026-06-07

### Changed
- Updated manifest description to better reflect current feature set

---

## [1.2.15] — 2026-06-07

### Added
- **New `FolderName:search` syntax** — `Snippets:music`, `Electronic:ambient`, `Resources:linux` etc. More intuitive than `folder:Name search`; mirrors how `site:` works in Google. Legacy `folder:` syntax still supported.
- **Filenames now searchable** — notes where the frontmatter title differs from the filename are now findable by filename

---

## [1.2.14] — 2026-06-07

### Fixed
- File basenames included in searchable index so notes are findable by filename even when frontmatter title differs

---

## [1.2.13] — 2026-06-07

### Improved
- **`folder:` now supports partial folder names** — `folder:Electronic` matches `Electronic Music`, `folder:Personal` matches `Personal Notes`, etc. Previously required exact single-word folder names. Mirrors how `site:` works in web search engines.

---

## [1.2.8] — 2026-06-05

### Fixed
- **Passes Obsidian automated plugin scan** — resolved all errors flagged by the community portal:
  - Replaced `innerHTML` with `sanitizeHTMLToDom()` throughout (safe HTML rendering for snippets)
  - Replaced raw `h2` heading in settings with `Setting.setHeading()` API
  - Removed inline style assignments; all colors now handled via CSS
  - Used `app.vault.configDir` instead of hardcoded `.obsidian` for config folder detection
  - Bumped `minAppVersion` to `1.5.3` to match APIs in use
  - Command ID and name simplified (Obsidian auto-prefixes with plugin ID)

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
