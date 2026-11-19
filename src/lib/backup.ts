import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { exportUserData, importUserData } from './db';

export interface BackupResult {
  ok: boolean;
  message?: string;
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Write a backup JSON into cache and hand it to the system share sheet. */
export async function shareBackup(): Promise<void> {
  const json = JSON.stringify(exportUserData(), null, 2);
  const file = new File(Paths.cache, `collect-backup-${timestamp()}.json`);
  file.writeSync(json);
  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: '导出 Collect 备份',
    });
  } finally {
    // Give the share target a moment to read the file before it disappears.
    setTimeout(() => {
      if (file.exists) file.delete();
    }, 60_000);
  }
}

/** Pick a backup JSON with the system file picker and merge it into the local store. */
export async function restoreBackup(): Promise<BackupResult> {
  const res = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled) return { ok: false };
  const asset = res.assets[0];
  if (!asset) return { ok: false };
  try {
    const file = new File(asset.uri);
    const result = importUserData(file.textSync());
    return {
      ok: true,
      message: `已恢复收藏 ${result.favorites} 条、已读标记 ${result.read} 条、推荐 ${result.recommend} 条。`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '导入失败，请确认是 Collect 导出的备份文件。';
    return { ok: false, message: msg };
  }
}
