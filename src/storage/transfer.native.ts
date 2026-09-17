import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { ARCHIVE_MIME, ARCHIVE_UTI } from './archive';

export async function shareArchiveFile(fileName: string, bytes: Uint8Array): Promise<void> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(bytes);
  try {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('当前环境无法分享文件');
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: ARCHIVE_MIME,
      UTI: ARCHIVE_UTI,
      dialogTitle: '导出职面存档',
    });
  } finally {
    if (file.exists) {
      file.delete();
    }
  }
}

export async function pickArchiveBytes(): Promise<Uint8Array | null> {
  try {
    const picked = await File.pickFileAsync();
    if ('canceled' in picked && picked.canceled) {
      return null;
    }
    const file = 'result' in picked ? picked.result : picked;
    if (!file || Array.isArray(file)) {
      return null;
    }
    return file.bytes();
  } catch {
    return null;
  }
}
