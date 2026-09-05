/**
 * Batgos — localStorage keys, in one place.
 *
 * These used to be `core_gym_*` / `core_ui_*` string literals scattered across
 * six files. `migrateLegacyKeys()` runs once before React mounts so the rebrand
 * does not sign existing users out or reset their theme.
 */

export const STORAGE_KEYS = {
  user: 'batgos_user',
  theme: 'batgos_theme',
  uiTheme: 'batgos_ui_theme',
  uiMode: 'batgos_ui_mode',
  cacheVersion: 'batgos_cache_version',
  lastPurge: 'batgos_last_purge',
  printer: 'batgos_printer_settings',
  gymSettings: 'batgos_settings',
};

/** old key -> new key */
const LEGACY_KEY_MAP = {
  core_gym_user: STORAGE_KEYS.user,
  core_gym_theme: STORAGE_KEYS.theme,
  core_ui_theme: STORAGE_KEYS.uiTheme,
  core_ui_mode: STORAGE_KEYS.uiMode,
  core_gym_cache_version: STORAGE_KEYS.cacheVersion,
  core_gym_last_purge: STORAGE_KEYS.lastPurge,
  core_gym_printer_settings: STORAGE_KEYS.printer,
  core_gym_settings: STORAGE_KEYS.gymSettings,
};

/**
 * Copy any `core_*` values onto their Batgos names, then drop the originals.
 * Safe to call repeatedly — it is a no-op once nothing legacy is left.
 */
export function migrateLegacyKeys() {
  try {
    for (const [oldKey, newKey] of Object.entries(LEGACY_KEY_MAP)) {
      const value = localStorage.getItem(oldKey);
      if (value === null) continue;
      if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, value);
      localStorage.removeItem(oldKey);
    }
  } catch {
    // Private mode / blocked site data — the app still boots, just unauthenticated.
  }
}

/** Keys wiped on login and logout. Theme preferences deliberately survive. */
export const SESSION_KEYS = [STORAGE_KEYS.user];

/** Keys that must survive a full storage clear. */
export const PRESERVED_KEYS = [
  STORAGE_KEYS.theme,
  STORAGE_KEYS.uiTheme,
  STORAGE_KEYS.uiMode,
  STORAGE_KEYS.printer,
];
