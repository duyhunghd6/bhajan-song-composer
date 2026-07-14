const COMPOSER_SONG_STORAGE_PREFIX = "bhajan-song-composer:compose:";

export function getComposerSongStoragePrefix(slug: string): string {
  return `${COMPOSER_SONG_STORAGE_PREFIX}${slug}:`;
}

export function getComposerMelodyStorageKey(slug: string): string {
  return `${getComposerSongStoragePrefix(slug)}melody`;
}

export function getComposerWorkspaceStorageKey(slug: string): string {
  return `${getComposerSongStoragePrefix(slug)}workspace`;
}

export function getComposerFingerstyleMeasuresStorageKey(slug: string): string {
  return `${getComposerSongStoragePrefix(slug)}fingerstyle-measures`;
}

export function getComposerFingerstyleDiagnosticsStorageKey(slug: string): string {
  return `${getComposerSongStoragePrefix(slug)}fingerstyle-diagnostics`;
}

export function clearComposerSongStorage(storage: Storage, slug: string): string[] {
  const prefix = getComposerSongStoragePrefix(slug);
  const keysToRemove: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    storage.removeItem(key);
  }

  return keysToRemove;
}
