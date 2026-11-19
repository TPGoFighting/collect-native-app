import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';

const IMAGE_CACHE_LIMIT = 200 * 1024 * 1024; // 200 MB (design doc 4.4)

/** Total bytes used by the app's cache directory (images live here via expo-image). */
export async function getCacheSize(): Promise<number> {
  let total = 0;
  const walk = (dir: Directory, depth: number): void => {
    if (depth > 4) return;
    let entries: (Directory | File)[] = [];
    try {
      entries = dir.list();
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry instanceof Directory) {
        walk(entry, depth + 1);
      } else if (entry instanceof File) {
        const size = (entry as File).size;
        if (typeof size === 'number') total += size;
      }
    }
  };
  try {
    walk(Paths.cache, 0);
  } catch {
    return 0;
  }
  return total;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Clear image disk cache (article text in SQLite is never touched). */
export async function clearImageCache(): Promise<void> {
  try {
    await Image.clearDiskCache();
  } catch {
    // older runtime: ignore
  }
  try {
    await Image.clearMemoryCache();
  } catch {
    // ignore
  }
}

/** If the image cache grows past the limit, drop it; images re-download on demand. */
export async function enforceImageCacheLimit(): Promise<boolean> {
  const size = await getCacheSize();
  if (size > IMAGE_CACHE_LIMIT) {
    await clearImageCache();
    return true;
  }
  return false;
}
