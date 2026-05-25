export interface NoteRecord {
  path: string;      // vault-relative, e.g. "Projects/MyNote.md"
  title: string;     // display title (frontmatter title || H1 || filename)
  para: string;      // top-level folder, e.g. "Projects"
  tags: string[];
  headers: string;   // space-joined H1-H3 text for scoring
  body: string;      // note body with frontmatter stripped
  created: string;   // ISO datetime string
}

export interface ParsedQuery {
  phrases: string[];
  required: string[];
  terms: string[];
  folderFilter: string | null;
}

export interface SearchResult {
  score: number;
  title: string;
  path: string;        // vault-relative
  breadcrumb: string;  // "Folder > SubFolder"
  para: string;
  snippet: string;     // HTML with <mark> highlights
  tags: string[];
  created: string;
}

export interface VaultDexSettings {
  maxResults: number;
  excludedFolders: string[];
}
