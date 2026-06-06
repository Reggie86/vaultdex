import { ItemView, Notice, TFile, ViewStateResult, WorkspaceLeaf, sanitizeHTMLToDom } from 'obsidian';
import { search } from './scorer';
import { NoteRecord, SearchResult } from './types';

export const VIEW_TYPE = 'vaultdex-search';

const PARA_LABELS: Record<string, string> = {
  'Projects': 'Projects',
  'Areas': 'Areas',
  'Resources': 'Resources',
  'Archive': 'Archive',
  'Daily Notes': 'Daily Notes',
  'Inbox': 'Inbox',
  '_Claude': 'Claude',
  '_MOCs': 'MOCs',
  '_Templates': 'Templates',
};

export class VaultDexView extends ItemView {
  private paraFilter: string | null = null;
  private tagFilter:  string | null = null;
  private sort: 'score' | 'date' = 'score';
  private lastQuery = '';
  private inputEl!: HTMLInputElement;

  constructor(
    leaf: WorkspaceLeaf,
    private getIndex: () => NoteRecord[] | null,
    private getMaxResults: () => number,
    private imgSrc: string,
    private version: string,
  ) {
    super(leaf);
  }

  getViewType()    { return VIEW_TYPE; }
  getDisplayText() { return 'VaultDex'; }
  getIcon()        { return 'eye'; }

  // ── Obsidian navigation state ───────────────────────────────────────────────

  getState(): Record<string, unknown> {
    return {
      query:       this.lastQuery,
      paraFilter:  this.paraFilter,
      tagFilter:   this.tagFilter,
      sort:        this.sort,
    };
  }

  async setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> {
    this.lastQuery  = typeof state.query      === 'string' ? state.query      : '';
    this.paraFilter = typeof state.paraFilter === 'string' ? state.paraFilter : null;
    this.tagFilter  = typeof state.tagFilter  === 'string' ? state.tagFilter  : null;
    this.sort       = state.sort === 'date' ? 'date' : 'score';
    result.history  = true;
    this.render();
  }

  async onOpen() { this.render(); }

  private navigate(patch: Partial<{
    query: string; paraFilter: string | null; tagFilter: string | null; sort: 'score' | 'date';
  }>) {
    this.leaf.setViewState({
      type: VIEW_TYPE,
      state: {
        query:      'query'      in patch ? (patch.query      ?? '') : this.lastQuery,
        paraFilter: 'paraFilter' in patch ? patch.paraFilter         : this.paraFilter,
        tagFilter:  'tagFilter'  in patch ? patch.tagFilter          : this.tagFilter,
        sort:       'sort'       in patch ? (patch.sort       ?? 'score') : this.sort,
      },
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private makeInput(parent: HTMLElement, cls: string, placeholder: string): HTMLInputElement {
    const inp = parent.createEl('input', { cls, type: 'text' } as never) as unknown as HTMLInputElement;
    inp.placeholder = placeholder;
    return inp;
  }

  private esc(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private makeSortBtn(wrap: HTMLElement, mode: 'score' | 'date', label: string) {
    const btn = wrap.createEl('button', {
      cls: 'vd-sort-btn' + (this.sort === mode ? ' active' : ''),
      text: label,
    });
    btn.addEventListener('click', () => this.navigate({ sort: mode }));
  }

  private openNote(path: string) {
    let file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      // Path is stale (note moved/renamed) — try to find by filename alone
      const basename = path.split('/').pop() ?? path;
      const found = this.app.metadataCache.getFirstLinkpathDest(basename.replace(/\.md$/, ''), '');
      if (found instanceof TFile) {
        file = found;
      } else {
        new Notice('Note not found — try closing and reopening VaultDex to refresh the index.');
        return;
      }
    }
    const ws = this.app.workspace;
    let rootLeaf: WorkspaceLeaf | null = null;
    ws.iterateRootLeaves((l: WorkspaceLeaf) => { if (!rootLeaf) rootLeaf = l; });
    if (rootLeaf) ws.setActiveLeaf(rootLeaf, { focus: false });
    ws.getLeaf('tab').openFile(file as TFile);
  }

  // Return tag-filtered notes as SearchResult objects (sorted, no snippet)
  private getTagResults(idx: NoteRecord[]): SearchResult[] {
    const tag = this.tagFilter!.toLowerCase();
    const results: SearchResult[] = idx
      .filter(n => n.tags.some(t => t.toLowerCase() === tag))
      .map(n => {
        const parts = n.path.split('/');
        parts.pop();
        return {
          score: 0,
          title: n.title,
          path: n.path,
          breadcrumb: parts.join(' › '),
          para: n.para,
          snippet: '',
          tags: n.tags,
          created: n.created,
        };
      });
    if (this.sort === 'date') {
      results.sort((a, b) => b.created.localeCompare(a.created));
    } else {
      results.sort((a, b) => a.title.localeCompare(b.title));
    }
    return results;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  private render() {
    const el = this.contentEl;
    el.empty();
    el.addClass('vaultdex-view');
    if (this.lastQuery || this.tagFilter) {
      this.renderResultsPage(el);
    } else {
      this.renderHomePage(el);
    }
  }

  private renderHomePage(el: HTMLElement) {
    const home = el.createEl('div', { cls: 'vd-home' });

    home.createEl('img', {
      cls: 'vd-logo-home',
      attr: { src: this.imgSrc, alt: 'VaultDex' },
    });

    home.createEl('div', { cls: 'vd-tagline', text: 'Search your personal knowledge vault' });

    const inputWrap = home.createEl('div', { cls: 'vd-input-wrap' });
    this.inputEl = this.makeInput(inputWrap, 'vd-input-home', 'Search vault…');

    home.createEl('div', {
      cls: 'vd-syntax-hint',
      text: '"exact phrase"  ·  word1 word2  ·  folder:<foldername> "search string"',
    });

    const btnRow = home.createEl('div', { cls: 'vd-home-btns' });
    const searchBtn = btnRow.createEl('button', { cls: 'vd-btn', text: 'Search Vault' });
    const luckyBtn  = btnRow.createEl('button', { cls: 'vd-btn', text: "I'm Feeling Lucky" });

    const idx = this.getIndex();
    home.createEl('div', {
      cls: 'vd-note-count',
      text: `${idx ? idx.length : 0} notes indexed — ${this.app.vault.getName()}`,
    });
    home.createEl('div', { cls: 'vd-version', text: `VaultDex v${this.version}` });

    const doSearch = () => {
      const q = this.inputEl.value.trim();
      if (q) this.navigate({ query: q, tagFilter: null, paraFilter: null });
    };
    const doLucky = () => {
      const index = this.getIndex();
      if (!index || index.length === 0) return;
      const note = index[Math.floor(Math.random() * index.length)];
      this.openNote(note.path);
    };

    searchBtn.addEventListener('click', doSearch);
    luckyBtn.addEventListener('click', doLucky);
    this.inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    this.inputEl.focus();
  }

  private renderResultsPage(el: HTMLElement) {
    const hdr = el.createEl('div', { cls: 'vd-results-hdr' });

    const logoBtn = hdr.createEl('img', {
      cls: 'vd-logo-compact',
      attr: { src: this.imgSrc, alt: 'VaultDex', title: 'Back to home' },
    });
    logoBtn.addEventListener('click', () =>
      this.navigate({ query: '', tagFilter: null, paraFilter: null }));

    const searchBar = hdr.createEl('div', { cls: 'vd-search-bar' });
    this.inputEl = this.makeInput(searchBar, 'vd-input', 'Search vault…');
    this.inputEl.value = this.lastQuery;
    const searchBtn = searchBar.createEl('button', { cls: 'vd-btn', text: 'Search' });

    el.createEl('hr', { cls: 'vd-rule' });

    const content = el.createEl('div', { cls: 'vd-content' });
    const main    = content.createEl('div', { cls: 'vd-main' });
    const sidebar = content.createEl('div', { cls: 'vd-sidebar' });

    this.renderResults(main);
    this.renderSidebar(sidebar);

    const doSearch = () => {
      const q = this.inputEl.value.trim();
      this.navigate({ query: q, tagFilter: null, paraFilter: this.paraFilter });
    };
    searchBtn.addEventListener('click', doSearch);
    this.inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  }

  private renderResults(container: HTMLElement) {
    const idx = this.getIndex();
    if (!idx) {
      container.createEl('div', { cls: 'vd-hint', text: 'Index is building — try again in a moment.' });
      return;
    }

    const results = this.tagFilter
      ? this.getTagResults(idx)
      : search(idx, this.lastQuery, this.paraFilter, this.sort, this.getMaxResults());

    const rhdr     = container.createEl('div', { cls: 'vd-rhdr' });
    const countSpan = rhdr.createEl('span', { cls: 'vd-rhdr-text' });
    const suffix   = results.length === 1 ? '' : 's';

    if (this.tagFilter) {
      countSpan.appendText('VaultDex found ');
      countSpan.createEl('strong', { text: `${results.length}` });
      countSpan.appendText(` note${suffix} tagged `);
      countSpan.createEl('strong', { text: `#${this.tagFilter}` });
    } else {
      countSpan.appendText('VaultDex found ');
      countSpan.createEl('strong', { text: `${results.length}` });
      countSpan.appendText(` result${suffix}`);
      if (this.paraFilter) {
        countSpan.appendText(' in ');
        countSpan.createEl('strong', { text: PARA_LABELS[this.paraFilter] ?? this.paraFilter });
      }
      countSpan.appendText(' for “');
      countSpan.createEl('strong', { text: this.lastQuery });
      countSpan.appendText('”');
    }

    const sortWrap = rhdr.createEl('span', { cls: 'vd-sort-wrap' });
    this.makeSortBtn(sortWrap, 'score', this.tagFilter ? 'A–Z' : 'Relevance');
    this.makeSortBtn(sortWrap, 'date', 'Newest');

    if (results.length === 0) {
      container.createEl('div', {
        cls: 'vd-noresults',
        text: this.tagFilter
          ? `No notes tagged #${this.tagFilter}.`
          : `No results for "${this.lastQuery}". Try different keywords.`,
      });
      return;
    }

    for (let i = 0; i < results.length; i++) {
      this.renderCard(container, results[i], i + 1);
    }
  }

  private renderSidebar(sidebar: HTMLElement) {
    const idx = this.getIndex();
    if (!idx) return;

    // Build category counts from the right source
    const counts = new Map<string, number>();
    if (this.tagFilter) {
      const tag = this.tagFilter.toLowerCase();
      for (const n of idx.filter(n => n.tags.some(t => t.toLowerCase() === tag))) {
        counts.set(n.para, (counts.get(n.para) ?? 0) + 1);
      }
    } else {
      for (const r of search(idx, this.lastQuery, null, 'score', idx.length)) {
        counts.set(r.para, (counts.get(r.para) ?? 0) + 1);
      }
    }
    if (counts.size === 0) return;

    sidebar.createEl('h3', { cls: 'vd-sidebar-h3', text: 'Categories' });

    if (this.paraFilter) {
      const allLink = sidebar.createEl('div', { cls: 'vd-sitem' })
        .createEl('a', { cls: 'vd-sitem-link', text: 'All results' });
      allLink.addEventListener('click', e => { e.preventDefault(); this.navigate({ paraFilter: null }); });
    }

    for (const [para, cnt] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      const item = sidebar.createEl('div', { cls: 'vd-sitem' });
      const link = item.createEl('a', {
        cls: 'vd-sitem-link' + (this.paraFilter === para ? ' vd-sitem-active' : ''),
        text: PARA_LABELS[para] ?? para,
      });
      link.addEventListener('click', e => { e.preventDefault(); this.navigate({ paraFilter: para }); });
      item.createEl('span', { cls: 'vd-scnt', text: ` (${cnt})` });
    }
  }

  private renderCard(container: HTMLElement, r: SearchResult, num: number) {
    const card = container.createEl('div', { cls: 'vd-result' });

    const titleRow = card.createEl('div', { cls: 'vd-rtitle' });
    titleRow.createEl('span', { cls: 'vd-rnum', text: `${num}.` });
    const link = titleRow.createEl('button', { cls: 'vd-title-btn', text: r.title });
    link.title = r.path;
    link.addEventListener('click', () => this.openNote(r.path));

    const pathStr = r.breadcrumb
      ? `${r.breadcrumb} › ${r.path.split('/').pop()?.replace(/\.md$/, '')}`
      : r.path.replace(/\.md$/, '');
    card.createEl('div', { cls: 'vd-rpath', text: pathStr });

    if (r.snippet) {
      const snip = card.createEl('div', { cls: 'vd-rsnip' });
      snip.appendChild(sanitizeHTMLToDom(r.snippet));
    }

    if (r.tags.length) {
      const tagRow = card.createEl('div', { cls: 'vd-rtags' });
      for (const tag of r.tags) {
        const tagEl = tagRow.createEl('span', { cls: 'vd-tag', text: tag });
        tagEl.addEventListener('click', () =>
          this.navigate({ tagFilter: tag, query: '', paraFilter: null }));
      }
    }
  }

  async onClose() { }
}
