import { FileSystemAdapter, Plugin, WorkspaceLeaf, normalizePath } from 'obsidian';
import { VaultDexView, VIEW_TYPE } from './view';
import { VaultDexSettingTab, DEFAULT_SETTINGS } from './settings';
import { buildIndex } from './indexer';
import { NoteRecord, VaultDexSettings } from './types';

export default class VaultDexPlugin extends Plugin {
  settings: VaultDexSettings = { ...DEFAULT_SETTINGS };
  private index: NoteRecord[] | null = null;
  private imgSrc = '';

  async onload() {
    await this.loadSettings();

    if (this.app.vault.adapter instanceof FileSystemAdapter) {
      this.imgSrc = this.app.vault.adapter.getResourcePath(
        normalizePath(this.manifest.dir + '/VaultDex.jpeg')
      );
    }

    this.registerView(
      VIEW_TYPE,
      leaf => new VaultDexView(leaf, () => this.index, () => this.settings.maxResults, this.imgSrc, this.manifest.version),
    );

    this.addRibbonIcon('eye', 'VaultDex Search', () => this.activateView());

    this.addCommand({
      id: 'open',
      name: 'Open search',
      callback: () => this.activateView(),
    });

    this.addSettingTab(new VaultDexSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => { void this.rebuildIndex(); });
  }

  async rebuildIndex() {
    this.index = await buildIndex(this.app, this.app.vault, this.settings);
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0] as WorkspaceLeaf | undefined;
    if (!leaf) {
      leaf = workspace.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    void workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<VaultDexSettings>);
  }

  async saveSettings() {
    await this.saveData(this.settings);
    await this.rebuildIndex();
  }

  onunload() { }
}
