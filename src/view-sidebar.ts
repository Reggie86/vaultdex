import { ItemView, TFile, WorkspaceLeaf, sanitizeHTMLToDom } from 'obsidian';
import { search } from './scorer';
import { NoteRecord, SearchResult } from './types';

export const VIEW_TYPE = 'vaultdex-search';

const PARA_LABELS: [string, string][] = [
  ['Projects', 'Projects'], ['Areas', 'Areas'], ['Resources', 'Resources'],
  ['Archive', 'Archive'], ['Daily Notes', 'Daily Notes'], ['Inbox', 'Inbox'],
  ['_Claude', 'Claude'], ['_MOCs', 'MOCs'], ['_Templates', 'Templates'],
];

export class VaultDexView extends ItemView {
  private paraFilter: string | null = null;
  private sort: 'score' | 'date' = 'score';
  private lastQuery = '';
  private resultsPane!: HTMLElement;
  private inputEl!: HTMLInputElement;
  private sidebarEl!: HTMLElement;
  private logoImgEl!: HTMLImageElement;

  constructor(
    leaf: WorkspaceLeaf,
    private getIndex: () => NoteRecord[] | null,
    private getMaxResults: () => number,
    private imgSrc: string,
    private version: string,
  ) {
    super(leaf);
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'VaultDex'; }
  getIcon() { return 'search'; }

  async onOpen() {
    this.build();
  }

  private build() {
    const el = this.contentEl;
    el.empty();
    el.addClass('vaultdex-view');

    // Top area: graphic above search bar
    const top = el.createEl('div', { cls: 'vd-top' });
    this.logoImgEl = top.createEl('img', {
      cls: 'vd-logo-img',
      attr: { src: this.imgSrc, alt: 'VaultDex' },
    });

    const searchBar = top.createEl('div', { cls: 'vd-search-bar' });
    this.inputEl = searchBar.createEl('input', {
      cls: 'vd-input', type: 'text',
      attr: { placeholder: 'Search your vault…' },
    });
    const btn = searchBar.createEl('button', { cls: 'vd-btn', text: 'Search' });

    // Purple rule
    el.createEl('hr', { cls: 'vd-rule' });

    // Main layout: sidebar + results
    const main = el.createEl('div', { cls: 'vd-main' });
    this.sidebarEl = main.createEl('div', { cls: 'vd-sidebar' });
    this.resultsPane = main.createEl('div', { cls: 'vd-results-pane' });

    this.buildSidebar();

    const doSearch = () => {
      this.lastQuery = this.inputEl.value.trim();
      this.runSearch();
    };
    btn.addEventListener('click', doSearch);
    this.inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

    if (this.lastQuery) {
      this.inputEl.value = this.lastQuery;
      this.logoImgEl.classList.add('vd-logo-compact');
      this.runSearch();
    }
  }

  private buildSidebar() {
    this.sidebarEl.empty();
    this.sidebarEl.createEl('div', { cls: 'vd-sidebar-title', text: 'Categories' });
    this.makeParaBtn(null, 'All results');
    for (const [key, label] of PARA_LABELS) {
      this.makeParaBtn(key, label);
    }
  }

  private makeParaBtn(key: string | null, label: string) {
    const btn = this.sidebarEl.createEl('button', {
      cls: 'vd-para-btn' + (this.paraFilter === key ? ' active' : ''),
      text: label,
    });
    btn.addEventListener('click', () => {
      this.paraFilter = key;
      this.buildSidebar();
      this.runSearch();
    });
  }

  private runSearch() {
    const pane = this.resultsPane;
    pane.empty();
    this.logoImgEl.classList.toggle('vd-logo-compact', !!this.lastQuery);

    if (!this.lastQuery) {
      pane.createEl('div', { cls: 'vd-tagline', text: 'Search your personal knowledge vault' });
      pane.createEl('div', { cls: 'vd-version', text: `VaultDex v${this.version}` });
      return;
    }

    const idx = this.getIndex();
    if (!idx) {
      pane.createEl('div', { cls: 'vd-hint', text: 'Index is building — try again in a moment.' });
      return;
    }

    const results = search(idx, this.lastQuery, this.paraFilter, this.sort, this.getMaxResults());

    // Results header with sort buttons
    const rhdr = pane.createEl('div', { cls: 'vd-rhdr' });
    const suffix = results.length === 1 ? '' : 's';
    rhdr.appendText('VaultDex found ');
    rhdr.createEl('strong', { text: `${results.length}` });
    rhdr.appendText(` result${suffix} for "`);
    rhdr.createEl('strong', { text: this.lastQuery });
    rhdr.appendText('"');
    const sortWrap = rhdr.createEl('span', { cls: 'vd-sort-wrap' });
    this.makeSortBtn(sortWrap, 'score', 'Relevance');
    this.makeSortBtn(sortWrap, 'date', 'Newest');

    if (results.length === 0) {
      pane.createEl('div', { cls: 'vd-noresults', text: `No results for "${this.lastQuery}". Try different keywords.` });
      return;
    }

    for (let i = 0; i < results.length; i++) {
      this.renderCard(pane, results[i], i + 1);
    }
  }

  private makeSortBtn(container: HTMLElement, mode: 'score' | 'date', label: string) {
    const btn = container.createEl('button', {
      cls: 'vd-sort-btn' + (this.sort === mode ? ' active' : ''),
      text: label,
    });
    btn.addEventListener('click', () => { this.sort = mode; this.runSearch(); });
  }

  private renderCard(container: HTMLElement, r: SearchResult, num: number) {
    const result = container.createEl('div', { cls: 'vd-result' });

    const titleRow = result.createEl('div', { cls: 'vd-rtitle' });
    titleRow.createEl('span', { cls: 'vd-rnum', text: `${num}.` });
    const link = titleRow.createEl('button', { cls: 'vd-title-btn', text: r.title });
    link.addEventListener('click', () => {
      const file = this.app.vault.getAbstractFileByPath(r.path);
      if (!(file instanceof TFile)) return;
      const ws = this.app.workspace;
      // Move active focus to a main-workspace leaf first so getLeaf('tab')
      // creates the tab there rather than in VaultDex's sidebar group.
      let rootLeaf: WorkspaceLeaf | null = null;
      ws.iterateRootLeaves((l: WorkspaceLeaf) => { if (!rootLeaf) rootLeaf = l; });
      if (rootLeaf) ws.setActiveLeaf(rootLeaf, { focus: false });
      void ws.getLeaf('tab').openFile(file);
    });

    const pathStr = r.breadcrumb
      ? `${r.breadcrumb} › ${r.path.split('/').pop()?.replace(/\.md$/, '')}`
      : r.path.replace(/\.md$/, '');
    result.createEl('div', { cls: 'vd-rpath', text: pathStr });

    const snip = result.createEl('div', { cls: 'vd-rsnip' });
    snip.appendChild(sanitizeHTMLToDom(r.snippet));

    if (r.tags.length) {
      const tagRow = result.createEl('div', { cls: 'vd-rtags' });
      for (const tag of r.tags) tagRow.createEl('span', { cls: 'vd-tag', text: tag });
    }
  }

  async onClose() { }
}
