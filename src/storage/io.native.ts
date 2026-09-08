import { Directory, File, Paths } from 'expo-file-system';

export function usersPath(): string {
  return 'users.json';
}

export function datasPath(): string {
  return 'datas';
}

export function userDirPath(hashid: string): string {
  return `datas/${hashid}`;
}

export function profilePath(hashid: string): string {
  return `datas/${hashid}/profile.json`;
}

export function jobsDirPath(hashid: string): string {
  return `datas/${hashid}/jobs`;
}

export function jobPath(hashid: string, jobId: string): string {
  return `datas/${hashid}/jobs/${jobId}.json`;
}

function nativeFile(rel: string): File {
  return new File(Paths.document, ...rel.split('/'));
}

function nativeDir(rel: string): Directory {
  return new Directory(Paths.document, ...rel.split('/'));
}

export function ensureDir(rel: string): void {
  nativeDir(rel).create({ intermediates: true, idempotent: true });
}

export function pathExists(rel: string): boolean {
  return nativeFile(rel).exists || nativeDir(rel).exists;
}

export function readJsonFile<T>(rel: string, fallback: T): T {
  const file = nativeFile(rel);
  if (!file.exists) {
    return fallback;
  }
  const text = file.textSync().trim();
  if (!text) {
    return fallback;
  }
  return JSON.parse(text) as T;
}

export function writeJsonFile(rel: string, data: unknown): void {
  const file = nativeFile(rel);
  if (!file.exists) {
    file.create();
  }
  file.write(`${JSON.stringify(data, null, 2)}\n`);
}

export function deleteFile(rel: string): void {
  const file = nativeFile(rel);
  if (file.exists) {
    file.delete();
  }
}

export function listFileNames(relDir: string): string[] {
  const dir = nativeDir(relDir);
  if (!dir.exists) {
    return [];
  }
  return dir.list().map((entry) => entry.name);
}

export function nowIso(): string {
  return new Date().toISOString();
}
