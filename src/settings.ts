import { App, PluginSettingTab, Setting } from 'obsidian';
import { VaultDexSettings } from './types';

export const DEFAULT_SETTINGS: VaultDexSettings = {
  maxResults: 50,
  excludedFolders: [],
};

export class VaultDexSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: { settings: VaultDexSettings; saveSettings(): Promise<void> }) {
    super(app, plugin as never);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setHeading();

    new Setting(containerEl)
      .setName('Max results')
      .setDesc('Maximum number of search results to show. Set to 0 for no limit.')
      .addText(text => text
        .setValue(String(this.plugin.settings.maxResults))
        .onChange(async value => {
          const n = parseInt(value);
          if (!isNaN(n) && n >= 0) {
            this.plugin.settings.maxResults = n;
            await this.plugin.saveSettings();
          }
        }));

    new Setting(containerEl)
      .setName('Excluded folders')
      .setDesc('Comma-separated top-level folders to skip during indexing.')
      .addText(text => text
        .setValue(this.plugin.settings.excludedFolders.join(', '))
        .onChange(async value => {
          this.plugin.settings.excludedFolders = value.split(',').map(s => s.trim()).filter(Boolean);
          await this.plugin.saveSettings();
        }));
  }
}
