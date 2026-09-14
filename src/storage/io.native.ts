import { Directory, File, Paths } from 'expo-file-system';

export {
  datasPath,
  jobPath,
  jobsDirPath,
  masterPath,
  nowIso,
  resumePath,
  resumesDirPath,
  userDirPath,
  usersPath,
} from './paths';

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
