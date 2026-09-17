import { ARCHIVE_MIME } from './archive';


export async function shareArchiveFile(fileName: string, bytes: Uint8Array): Promise<void> {
  const blob = new Blob([bytes as BlobPart], { type: ARCHIVE_MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function pickArchiveBytes(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zm,application/x-zhimian-archive,application/zip';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      void file.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)));
    };
    input.click();
  });
}
