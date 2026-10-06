// Settings & persistent storage service using chrome.storage.local.
// Storage is restricted to harmless user preferences. No thread content, usernames or URLs are persisted.

export interface AppSettings {
  maxComments: number;
  similaritySearchEnabled: boolean;
  autoAnalysis: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  maxComments: 1000,
  similaritySearchEnabled: true,
  autoAnalysis: false,
};

export const MIN_COMMENT_LIMIT = 50;
export const MAX_COMMENT_LIMIT = 10000;

const STORAGE_KEY = 'redditdig_settings';

/** Clamp an arbitrary value into the supported comment-limit range (falls back to the default). */
export function clampCommentLimit(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SETTINGS.maxComments;
  return Math.min(Math.max(Math.round(n), MIN_COMMENT_LIMIT), MAX_COMMENT_LIMIT);
}

/**
 * Whitelist + type-check anything read from storage. Unknown keys (e.g. the removed `theme`
 * preference or anything a corrupted profile contains) are dropped instead of spread into state.
 */
export function normalizeSettings(raw: unknown): AppSettings {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    maxComments: 'maxComments' in src ? clampCommentLimit(src.maxComments) : DEFAULT_SETTINGS.maxComments,
    similaritySearchEnabled:
      typeof src.similaritySearchEnabled === 'boolean'
        ? src.similaritySearchEnabled
        : DEFAULT_SETTINGS.similaritySearchEnabled,
    autoAnalysis: typeof src.autoAnalysis === 'boolean' ? src.autoAnalysis : DEFAULT_SETTINGS.autoAnalysis,
  };
}

const hasChromeStorage = () => typeof chrome !== 'undefined' && !!chrome.storage?.local;

async function readRaw(): Promise<unknown> {
  if (hasChromeStorage()) {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return stored?.[STORAGE_KEY];
  }
  if (typeof localStorage !== 'undefined') {
    const local = localStorage.getItem(STORAGE_KEY);
    return local ? JSON.parse(local) : undefined;
  }
  return undefined;
}

async function writeRaw(value: AppSettings): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [STORAGE_KEY]: value });
  } else if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }
}

// Serialize read-modify-write cycles so concurrent saves cannot overwrite each other.
let writeQueue: Promise<unknown> = Promise.resolve();

export class StorageService {
  static async getSettings(): Promise<AppSettings> {
    try {
      return normalizeSettings(await readRaw());
    } catch (e) {
      console.warn('RedditDIG: could not read settings, using defaults:', e);
      return { ...DEFAULT_SETTINGS };
    }
  }

  /** Persists a partial update and returns the stored result. Rejects if the write fails. */
  static saveSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    const run = async (): Promise<AppSettings> => {
      let current: AppSettings;
      try {
        current = normalizeSettings(await readRaw());
      } catch {
        current = { ...DEFAULT_SETTINGS };
      }
      const updated = normalizeSettings({ ...current, ...partial });
      await writeRaw(updated);
      return updated;
    };
    const result = writeQueue.then(run, run);
    writeQueue = result.catch(() => undefined);
    return result;
  }

  /** Removes everything RedditDIG stores. */
  static async clearAllData(): Promise<void> {
    try {
      if (hasChromeStorage()) {
        await chrome.storage.local.remove(STORAGE_KEY);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('RedditDIG: could not clear stored settings:', e);
      throw e;
    }
  }

  static async clearSettings(): Promise<void> {
    return this.clearAllData();
  }
}
