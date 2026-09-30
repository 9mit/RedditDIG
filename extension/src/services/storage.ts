// Settings & Persistent Storage Service using chrome.storage.local
// Production architecture: strictly database-free, storage is restricted to harmless user preferences only.
// Zero remote URLs, zero tracking IDs, zero remote AI configuration.

export interface AppSettings {
  maxComments: number;
  similaritySearchEnabled: boolean;
  autoAnalysis: boolean;
  theme: 'dark' | 'light';
}

export const DEFAULT_SETTINGS: AppSettings = {
  maxComments: 500,
  similaritySearchEnabled: true,
  autoAnalysis: false,
  theme: 'dark',
};

const STORAGE_KEY = 'redditdig_settings';

export class StorageService {
  static async getSettings(): Promise<AppSettings> {
    let settings: AppSettings = { ...DEFAULT_SETTINGS };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const stored = await chrome.storage.local.get(STORAGE_KEY);
        if (stored && stored[STORAGE_KEY]) {
          settings = { ...settings, ...stored[STORAGE_KEY] };
        }
      } catch (e) {
        console.warn('Error reading settings from chrome.storage.local:', e);
      }
    } else if (typeof localStorage !== 'undefined') {
      try {
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) {
          settings = { ...settings, ...JSON.parse(local) };
        }
      } catch (e) {
        console.warn('Error reading settings from localStorage:', e);
      }
    }

    return settings;
  }

  static async saveSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    let current: AppSettings = { ...DEFAULT_SETTINGS };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const stored = await chrome.storage.local.get(STORAGE_KEY);
        if (stored && stored[STORAGE_KEY]) {
          current = { ...current, ...stored[STORAGE_KEY] };
        }
      } catch {}
    } else if (typeof localStorage !== 'undefined') {
      try {
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) {
          current = { ...current, ...JSON.parse(local) };
        }
      } catch {}
    }

    const updated: AppSettings = {
      ...current,
      ...partial
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        await chrome.storage.local.set({ [STORAGE_KEY]: updated });
      } catch (e) {
        console.warn('Error writing settings to chrome.storage.local:', e);
      }
    } else if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Error writing settings to localStorage:', e);
      }
    }

    return updated;
  }

  static async clearAllData(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        await chrome.storage.local.clear();
      } catch (e) {
        console.warn('Error clearing chrome.storage.local:', e);
      }
    } else if (typeof localStorage !== 'undefined') {
      try {
        localStorage.clear();
      } catch (e) {
        console.warn('Error clearing localStorage:', e);
      }
    }
  }

  static async clearSettings(): Promise<void> {
    return this.clearAllData();
  }
}
