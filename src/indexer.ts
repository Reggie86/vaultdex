import { App, Vault } from 'obsidian';
import { NoteRecord, VaultDexSettings } from './types';

const STATIC_SKIP_DIRS = new Set([
  '.claude', '.git', '_Sources', 'Pinboard', '_Vault Scripts', 'plugin settings',
]);

function parseFrontmatter(text: string): { tags: string[]; title: string; created: string; body: string } {
  let tags: string[] = [], title = '', created = '', body = text;
  if (text.startsWith('---')) {
    const end = text.indexOf('\n---', 3);
    if (end !== -1) {
      const fm = text.slice(3, end);
      body = text.slice(end + 4);
      const tagBlock = fm.match(/^tags:\s*\n((?:[ \t]+-[^\n]+\n)*)/m);
      if (tagBlock) tags = [...tagBlock[1].matchAll(/-\s*(.+)/g)].map(m => m[1].trim());
      const titleM = fm.match(/^title:\s*(.+)/m);
      if (titleM) title = titleM[1].trim().replace(/^['"]|['"]$/g, '');
      const dateM = fm.match(/^created:\s*(.+)/m) ?? fm.match(/^modified:\s*(.+)/m);
      if (dateM) created = dateM[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return { tags, title, created, body };
}

export async function buildIndex(app: App, vault: Vault, settings: VaultDexSettings): Promise<NoteRecord[]> {
  const configDir = app.vault.configDir;
  const skipDirs = new Set([...STATIC_SKIP_DIRS, configDir]);
  const files = vault.getMarkdownFiles();
  const records: NoteRecord[] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    if (parts.some(p => skipDirs.has(p) || p.startsWith('.'))) continue;
    if (settings.excludedFolders.some(f => file.path.startsWith(f + '/'))) continue;

    try {
      const text = await vault.read(file);
      const { tags, title, created, body } = parseFrontmatter(text);

      const h1Match = body.match(/^#\s+(.+)/m);
      let displayTitle = title || (h1Match ? h1Match[1] : file.basename);
      displayTitle = displayTitle
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
        .trim();

      const headers = (body.match(/^#{1,3}\s+(.+)/gm) ?? []).join(' ');
      const para = parts[0] ?? '';
      const createdStr = created || new Date(file.stat.mtime).toISOString();

      records.push({ path: file.path, title: displayTitle, para, tags, headers, body, created: createdStr });
    } catch {
      // skip unreadable files
    }
  }

  return records;
}
