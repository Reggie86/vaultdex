var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => VaultDexPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/view.ts
var import_obsidian = require("obsidian");

// src/parser.ts
function parseQuery(raw) {
  let query = raw.trim();
  let folderFilter = null;
  const folderMatch = query.match(/^folder:(\S+)\s*/i);
  if (folderMatch) {
    folderFilter = folderMatch[1];
    query = query.slice(folderMatch[0].length);
  }
  const phrases = [...query.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const remainder = query.replace(/"[^"]+"/g, "").trim();
  const required = [];
  const terms = [];
  for (const token of remainder.split(/\s+/).filter(Boolean)) {
    if (token.includes("+")) {
      required.push(...token.split("+").filter(Boolean));
    } else {
      terms.push(token);
    }
  }
  return { phrases, required, terms, folderFilter };
}

// src/scorer.ts
var STOP_WORDS = /* @__PURE__ */ new Set([
  "a",
  "an",
  "the",
  "is",
  "in",
  "on",
  "of",
  "to",
  "at",
  "by",
  "for",
  "or",
  "and",
  "but",
  "this",
  "that",
  "these",
  "those",
  "with",
  "from",
  "one",
  "two",
  "as",
  "be",
  "it",
  "its",
  "not",
  "are",
  "was",
  "were",
  "has",
  "have",
  "had",
  "do",
  "did",
  "does",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "my",
  "your",
  "his",
  "her",
  "our",
  "their",
  "we",
  "you",
  "he",
  "she",
  "they",
  "i",
  "me",
  "him",
  "us"
]);
function count(haystack, needle) {
  let n = 0, pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    n++;
    pos += needle.length;
  }
  return n;
}
function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function extractSnippet(body, terms, length = 240) {
  let plain = body.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  plain = plain.replace(/[*_`#>~]/g, "").replace(/\s+/g, " ").trim();
  const lower = plain.toLowerCase();
  let bestPos = 0, bestScore = 0;
  for (let i = 0; i < Math.max(1, lower.length - length); i += 40) {
    const s = terms.reduce((acc, t) => acc + count(lower.slice(i, i + length), t.toLowerCase()), 0);
    if (s > bestScore) {
      bestScore = s;
      bestPos = i;
    }
  }
  let snip = plain.slice(bestPos, bestPos + length).trim();
  if (bestPos > 0) snip = "\u2026" + snip;
  if (bestPos + length < plain.length) snip += "\u2026";
  for (const term of [...terms].sort((a, b) => b.length - a.length)) {
    snip = snip.replace(new RegExp(`(${escRe(term)})`, "gi"), "<mark>$1</mark>");
  }
  return snip;
}
function scoreNote(record, query, paraFilter, folderFilter) {
  if (paraFilter && record.para !== paraFilter) return null;
  if (folderFilter) {
    const dirs = record.path.split("/").slice(0, -1);
    if (!dirs.some((d) => d.toLowerCase() === folderFilter.toLowerCase())) return null;
  }
  const lTitle = record.title.toLowerCase();
  const lTags = record.tags.join(" ").toLowerCase();
  const lHdrs = record.headers.toLowerCase();
  const lBody = record.body.toLowerCase();
  let score = 0, matched = false;
  for (const term of query.required) {
    const t = term.toLowerCase();
    if (![lBody, lTitle, lTags, lHdrs].some((s) => s.includes(t))) return null;
    const nT = count(lTitle, t), nG = count(lTags, t), nH = count(lHdrs, t), nB = count(lBody, t);
    if (nT) {
      score += 15 * nT;
      matched = true;
    }
    if (nG) {
      score += 12 * nG;
      matched = true;
    }
    if (nH) {
      score += 8 * nH;
      matched = true;
    }
    if (nB) {
      score += Math.min(nB, 20) * 2;
      matched = true;
    }
  }
  for (const phrase of query.phrases) {
    const p = phrase.toLowerCase();
    if (![lBody, lTitle, lTags, lHdrs].some((s) => s.includes(p))) return null;
    const nT = count(lTitle, p), nG = count(lTags, p), nH = count(lHdrs, p), nB = count(lBody, p);
    if (nT) {
      score += 40 * nT;
      matched = true;
    }
    if (nG) {
      score += 30 * nG;
      matched = true;
    }
    if (nH) {
      score += 20 * nH;
      matched = true;
    }
    if (nB) {
      score += Math.min(nB, 20) * 3;
      matched = true;
    }
  }
  for (const term of query.terms) {
    const t = term.toLowerCase();
    const nT = count(lTitle, t), nG = count(lTags, t), nH = count(lHdrs, t), nB = count(lBody, t);
    if (nT) {
      score += 10 * nT;
      matched = true;
    }
    if (nG) {
      score += 8 * nG;
      matched = true;
    }
    if (nH) {
      score += Math.min(nH, 5) * 5;
      matched = true;
    }
    if (nB) {
      score += Math.min(nB, 20);
      matched = true;
    }
  }
  if (!matched) return null;
  if (query.terms.length > 1) {
    const sig = query.terms.filter((t) => !STOP_WORDS.has(t.toLowerCase()));
    const eff = sig.length > 0 ? sig : query.terms;
    const allPresent = eff.every((t) => {
      const tl = t.toLowerCase();
      return lBody.includes(tl) || lTitle.includes(tl) || lTags.includes(tl) || lHdrs.includes(tl);
    });
    if (allPresent) score += 100 * eff.length;
    if (eff.every((t) => lTitle.includes(t.toLowerCase()))) score += 600;
  }
  const parts = record.path.split("/");
  return {
    score,
    title: record.title,
    path: record.path,
    breadcrumb: parts.slice(0, -1).join(" \u203A "),
    para: record.para,
    snippet: extractSnippet(record.body, [...query.phrases, ...query.required, ...query.terms]),
    tags: record.tags.slice(0, 6),
    created: record.created
  };
}
function search(index, rawQuery, paraFilter, sort, maxResults) {
  const query = parseQuery(rawQuery);
  const { folderFilter } = query;
  if (!query.phrases.length && !query.required.length && !query.terms.length && !folderFilter) return [];
  const results = index.map((r) => scoreNote(r, query, paraFilter, folderFilter)).filter((r) => r !== null);
  results.sort(
    sort === "date" ? (a, b) => b.created.localeCompare(a.created) : (a, b) => b.score - a.score
  );
  return results.slice(0, maxResults);
}

// src/view.ts
var VIEW_TYPE = "vaultdex-search";
var PARA_LABELS = {
  "Projects": "Projects",
  "Areas": "Areas",
  "Resources": "Resources",
  "Archive": "Archive",
  "Daily Notes": "Daily Notes",
  "Inbox": "Inbox",
  "_Claude": "Claude",
  "_MOCs": "MOCs",
  "_Templates": "Templates"
};
var VaultDexView = class extends import_obsidian.ItemView {
  constructor(leaf, getIndex, getMaxResults, imgSrc, version) {
    super(leaf);
    this.getIndex = getIndex;
    this.getMaxResults = getMaxResults;
    this.imgSrc = imgSrc;
    this.version = version;
    this.paraFilter = null;
    this.tagFilter = null;
    this.sort = "score";
    this.lastQuery = "";
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "VaultDex";
  }
  getIcon() {
    return "eye";
  }
  // ── Obsidian navigation state ───────────────────────────────────────────────
  getState() {
    return {
      query: this.lastQuery,
      paraFilter: this.paraFilter,
      tagFilter: this.tagFilter,
      sort: this.sort
    };
  }
  async setState(state, result) {
    this.lastQuery = typeof state.query === "string" ? state.query : "";
    this.paraFilter = typeof state.paraFilter === "string" ? state.paraFilter : null;
    this.tagFilter = typeof state.tagFilter === "string" ? state.tagFilter : null;
    this.sort = state.sort === "date" ? "date" : "score";
    result.history = true;
    this.render();
  }
  async onOpen() {
    this.render();
  }
  navigate(patch) {
    var _a, _b;
    this.leaf.setViewState({
      type: VIEW_TYPE,
      state: {
        query: "query" in patch ? (_a = patch.query) != null ? _a : "" : this.lastQuery,
        paraFilter: "paraFilter" in patch ? patch.paraFilter : this.paraFilter,
        tagFilter: "tagFilter" in patch ? patch.tagFilter : this.tagFilter,
        sort: "sort" in patch ? (_b = patch.sort) != null ? _b : "score" : this.sort
      }
    });
  }
  // ── Helpers ─────────────────────────────────────────────────────────────────
  makeInput(parent, cls, placeholder) {
    const inp = parent.createEl("input", { cls, type: "text" });
    inp.placeholder = placeholder;
    return inp;
  }
  esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  makeSortBtn(wrap, mode, label) {
    const btn = wrap.createEl("button", {
      cls: "vd-sort-btn" + (this.sort === mode ? " active" : ""),
      text: label
    });
    btn.addEventListener("click", () => this.navigate({ sort: mode }));
  }
  openNote(path) {
    var _a;
    let file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof import_obsidian.TFile)) {
      const basename = (_a = path.split("/").pop()) != null ? _a : path;
      const found = this.app.metadataCache.getFirstLinkpathDest(basename.replace(/\.md$/, ""), "");
      if (found instanceof import_obsidian.TFile) {
        file = found;
      } else {
        new import_obsidian.Notice("Note not found \u2014 try closing and reopening VaultDex to refresh the index.");
        return;
      }
    }
    const ws = this.app.workspace;
    let rootLeaf = null;
    ws.iterateRootLeaves((l) => {
      if (!rootLeaf) rootLeaf = l;
    });
    if (rootLeaf) ws.setActiveLeaf(rootLeaf, { focus: false });
    ws.getLeaf("tab").openFile(file);
  }
  // Return tag-filtered notes as SearchResult objects (sorted, no snippet)
  getTagResults(idx) {
    const tag = this.tagFilter.toLowerCase();
    const results = idx.filter((n) => n.tags.some((t) => t.toLowerCase() === tag)).map((n) => {
      const parts = n.path.split("/");
      parts.pop();
      return {
        score: 0,
        title: n.title,
        path: n.path,
        breadcrumb: parts.join(" \u203A "),
        para: n.para,
        snippet: "",
        tags: n.tags,
        created: n.created
      };
    });
    if (this.sort === "date") {
      results.sort((a, b) => b.created.localeCompare(a.created));
    } else {
      results.sort((a, b) => a.title.localeCompare(b.title));
    }
    return results;
  }
  // ── Render ──────────────────────────────────────────────────────────────────
  render() {
    const el = this.contentEl;
    el.empty();
    el.addClass("vaultdex-view");
    if (this.lastQuery || this.tagFilter) {
      this.renderResultsPage(el);
    } else {
      this.renderHomePage(el);
    }
  }
  renderHomePage(el) {
    const home = el.createEl("div", { cls: "vd-home" });
    home.createEl("img", {
      cls: "vd-logo-home",
      attr: { src: this.imgSrc, alt: "VaultDex" }
    });
    home.createEl("div", { cls: "vd-tagline", text: "Search your personal knowledge vault" });
    const inputWrap = home.createEl("div", { cls: "vd-input-wrap" });
    this.inputEl = this.makeInput(inputWrap, "vd-input-home", "Search vault\u2026");
    home.createEl("div", {
      cls: "vd-syntax-hint",
      text: '"exact phrase"  \xB7  word1 word2  \xB7  folder:<foldername> "search string"'
    });
    const btnRow = home.createEl("div", { cls: "vd-home-btns" });
    const searchBtn = btnRow.createEl("button", { cls: "vd-btn", text: "Search Vault" });
    const luckyBtn = btnRow.createEl("button", { cls: "vd-btn", text: "I'm Feeling Lucky" });
    const idx = this.getIndex();
    home.createEl("div", {
      cls: "vd-note-count",
      text: `${idx ? idx.length : 0} notes indexed \u2014 ${this.app.vault.getName()}`
    });
    home.createEl("div", { cls: "vd-version", text: `VaultDex v${this.version}` });
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
    searchBtn.addEventListener("click", doSearch);
    luckyBtn.addEventListener("click", doLucky);
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });
    this.inputEl.focus();
  }
  renderResultsPage(el) {
    const hdr = el.createEl("div", { cls: "vd-results-hdr" });
    const logoBtn = hdr.createEl("img", {
      cls: "vd-logo-compact",
      attr: { src: this.imgSrc, alt: "VaultDex", title: "Back to home" }
    });
    logoBtn.addEventListener("click", () => this.navigate({ query: "", tagFilter: null, paraFilter: null }));
    const searchBar = hdr.createEl("div", { cls: "vd-search-bar" });
    this.inputEl = this.makeInput(searchBar, "vd-input", "Search vault\u2026");
    this.inputEl.value = this.lastQuery;
    const searchBtn = searchBar.createEl("button", { cls: "vd-btn", text: "Search" });
    el.createEl("hr", { cls: "vd-rule" });
    const content = el.createEl("div", { cls: "vd-content" });
    const main = content.createEl("div", { cls: "vd-main" });
    const sidebar = content.createEl("div", { cls: "vd-sidebar" });
    this.renderResults(main);
    this.renderSidebar(sidebar);
    const doSearch = () => {
      const q = this.inputEl.value.trim();
      this.navigate({ query: q, tagFilter: null, paraFilter: this.paraFilter });
    };
    searchBtn.addEventListener("click", doSearch);
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });
  }
  renderResults(container) {
    var _a;
    const idx = this.getIndex();
    if (!idx) {
      container.createEl("div", { cls: "vd-hint", text: "Index is building \u2014 try again in a moment." });
      return;
    }
    const results = this.tagFilter ? this.getTagResults(idx) : search(idx, this.lastQuery, this.paraFilter, this.sort, this.getMaxResults());
    const rhdr = container.createEl("div", { cls: "vd-rhdr" });
    const countSpan = rhdr.createEl("span", { cls: "vd-rhdr-text" });
    const suffix = results.length === 1 ? "" : "s";
    if (this.tagFilter) {
      countSpan.appendText("VaultDex found ");
      countSpan.createEl("strong", { text: `${results.length}` });
      countSpan.appendText(` note${suffix} tagged `);
      countSpan.createEl("strong", { text: `#${this.tagFilter}` });
    } else {
      countSpan.appendText("VaultDex found ");
      countSpan.createEl("strong", { text: `${results.length}` });
      countSpan.appendText(` result${suffix}`);
      if (this.paraFilter) {
        countSpan.appendText(" in ");
        countSpan.createEl("strong", { text: (_a = PARA_LABELS[this.paraFilter]) != null ? _a : this.paraFilter });
      }
      countSpan.appendText(" for \u201C");
      countSpan.createEl("strong", { text: this.lastQuery });
      countSpan.appendText("\u201D");
    }
    const sortWrap = rhdr.createEl("span", { cls: "vd-sort-wrap" });
    this.makeSortBtn(sortWrap, "score", this.tagFilter ? "A\u2013Z" : "Relevance");
    this.makeSortBtn(sortWrap, "date", "Newest");
    if (results.length === 0) {
      container.createEl("div", {
        cls: "vd-noresults",
        text: this.tagFilter ? `No notes tagged #${this.tagFilter}.` : `No results for "${this.lastQuery}". Try different keywords.`
      });
      return;
    }
    for (let i = 0; i < results.length; i++) {
      this.renderCard(container, results[i], i + 1);
    }
  }
  renderSidebar(sidebar) {
    var _a, _b, _c;
    const idx = this.getIndex();
    if (!idx) return;
    const counts = /* @__PURE__ */ new Map();
    if (this.tagFilter) {
      const tag = this.tagFilter.toLowerCase();
      for (const n of idx.filter((n2) => n2.tags.some((t) => t.toLowerCase() === tag))) {
        counts.set(n.para, ((_a = counts.get(n.para)) != null ? _a : 0) + 1);
      }
    } else {
      for (const r of search(idx, this.lastQuery, null, "score", idx.length)) {
        counts.set(r.para, ((_b = counts.get(r.para)) != null ? _b : 0) + 1);
      }
    }
    if (counts.size === 0) return;
    sidebar.createEl("h3", { cls: "vd-sidebar-h3", text: "Categories" });
    if (this.paraFilter) {
      const allLink = sidebar.createEl("div", { cls: "vd-sitem" }).createEl("a", { cls: "vd-sitem-link", text: "All results" });
      allLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.navigate({ paraFilter: null });
      });
    }
    for (const [para, cnt] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      const item = sidebar.createEl("div", { cls: "vd-sitem" });
      const link = item.createEl("a", {
        cls: "vd-sitem-link" + (this.paraFilter === para ? " vd-sitem-active" : ""),
        text: (_c = PARA_LABELS[para]) != null ? _c : para
      });
      link.addEventListener("click", (e) => {
        e.preventDefault();
        this.navigate({ paraFilter: para });
      });
      item.createEl("span", { cls: "vd-scnt", text: ` (${cnt})` });
    }
  }
  renderCard(container, r, num) {
    var _a;
    const card = container.createEl("div", { cls: "vd-result" });
    const titleRow = card.createEl("div", { cls: "vd-rtitle" });
    titleRow.createEl("span", { cls: "vd-rnum", text: `${num}.` });
    const link = titleRow.createEl("button", { cls: "vd-title-btn", text: r.title });
    link.title = r.path;
    link.addEventListener("click", () => this.openNote(r.path));
    const pathStr = r.breadcrumb ? `${r.breadcrumb} \u203A ${(_a = r.path.split("/").pop()) == null ? void 0 : _a.replace(/\.md$/, "")}` : r.path.replace(/\.md$/, "");
    card.createEl("div", { cls: "vd-rpath", text: pathStr });
    if (r.snippet) {
      const snip = card.createEl("div", { cls: "vd-rsnip" });
      snip.appendChild((0, import_obsidian.sanitizeHTMLToDom)(r.snippet));
    }
    if (r.tags.length) {
      const tagRow = card.createEl("div", { cls: "vd-rtags" });
      for (const tag of r.tags) {
        const tagEl = tagRow.createEl("span", { cls: "vd-tag", text: tag });
        tagEl.addEventListener("click", () => this.navigate({ tagFilter: tag, query: "", paraFilter: null }));
      }
    }
  }
  async onClose() {
  }
};

// src/settings.ts
var import_obsidian2 = require("obsidian");
var DEFAULT_SETTINGS = {
  maxResults: 25,
  excludedFolders: []
};
var VaultDexSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian2.Setting(containerEl).setName("VaultDex Settings").setHeading();
    new import_obsidian2.Setting(containerEl).setName("Max results").setDesc("Maximum number of search results to show.").addText((text) => text.setValue(String(this.plugin.settings.maxResults)).onChange(async (value) => {
      const n = parseInt(value);
      if (!isNaN(n) && n > 0) {
        this.plugin.settings.maxResults = n;
        await this.plugin.saveSettings();
      }
    }));
    new import_obsidian2.Setting(containerEl).setName("Excluded folders").setDesc("Comma-separated top-level folders to skip during indexing.").addText((text) => text.setValue(this.plugin.settings.excludedFolders.join(", ")).onChange(async (value) => {
      this.plugin.settings.excludedFolders = value.split(",").map((s) => s.trim()).filter(Boolean);
      await this.plugin.saveSettings();
    }));
  }
};

// src/indexer.ts
var STATIC_SKIP_DIRS = /* @__PURE__ */ new Set([
  ".claude",
  ".git",
  "_Sources",
  "Pinboard",
  "_Vault Scripts",
  "plugin settings"
]);
function parseFrontmatter(text) {
  var _a;
  let tags = [], title = "", created = "", body = text;
  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end !== -1) {
      const fm = text.slice(3, end);
      body = text.slice(end + 4);
      const tagBlock = fm.match(/^tags:\s*\n((?:[ \t]+-[^\n]+\n)*)/m);
      if (tagBlock) tags = [...tagBlock[1].matchAll(/-\s*(.+)/g)].map((m) => m[1].trim());
      const titleM = fm.match(/^title:\s*(.+)/m);
      if (titleM) title = titleM[1].trim().replace(/^['"]|['"]$/g, "");
      const dateM = (_a = fm.match(/^created:\s*(.+)/m)) != null ? _a : fm.match(/^modified:\s*(.+)/m);
      if (dateM) created = dateM[1].trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return { tags, title, created, body };
}
async function buildIndex(app, vault, settings) {
  var _a, _b;
  const configDir = app.vault.configDir;
  const skipDirs = /* @__PURE__ */ new Set([...STATIC_SKIP_DIRS, configDir]);
  const files = vault.getMarkdownFiles();
  const records = [];
  for (const file of files) {
    const parts = file.path.split("/");
    if (parts.some((p) => skipDirs.has(p) || p.startsWith("."))) continue;
    if (settings.excludedFolders.some((f) => file.path.startsWith(f + "/"))) continue;
    try {
      const text = await vault.read(file);
      const { tags, title, created, body } = parseFrontmatter(text);
      const h1Match = body.match(/^#\s+(.+)/m);
      let displayTitle = title || (h1Match ? h1Match[1] : file.basename);
      displayTitle = displayTitle.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1").trim();
      const headers = ((_a = body.match(/^#{1,3}\s+(.+)/gm)) != null ? _a : []).join(" ");
      const para = (_b = parts[0]) != null ? _b : "";
      const createdStr = created || new Date(file.stat.mtime).toISOString();
      records.push({ path: file.path, title: displayTitle, para, tags, headers, body, created: createdStr });
    } catch (e) {
    }
  }
  return records;
}

// src/main.ts
var VaultDexPlugin = class extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
    this.index = null;
    this.imgSrc = "";
  }
  async onload() {
    await this.loadSettings();
    if (this.app.vault.adapter instanceof import_obsidian3.FileSystemAdapter) {
      this.imgSrc = this.app.vault.adapter.getResourcePath(
        (0, import_obsidian3.normalizePath)(this.manifest.dir + "/VaultDex.jpeg")
      );
    }
    this.registerView(
      VIEW_TYPE,
      (leaf) => new VaultDexView(leaf, () => this.index, () => this.settings.maxResults, this.imgSrc, this.manifest.version)
    );
    this.addRibbonIcon("eye", "VaultDex Search", () => this.activateView());
    this.addCommand({
      id: "open",
      name: "Open search",
      callback: () => this.activateView()
    });
    this.addSettingTab(new VaultDexSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(() => this.rebuildIndex());
  }
  async rebuildIndex() {
    this.index = await buildIndex(this.app, this.app.vault, this.settings);
  }
  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    await this.rebuildIndex();
  }
  onunload() {
  }
};
