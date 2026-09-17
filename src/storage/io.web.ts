const PREFIX = 'zhimian.fs:';

export {
  audioDirPath,
  audioPath,
  bankPath,
  banksDirPath,
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

function key(rel: string): string {
  return PREFIX + rel.replace(/^\/+|\/+$/g, '');
}

export function ensureDir(_rel: string): void {
  // Virtual paths in localStorage do not need directories.
}

export function pathExists(rel: string): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  if (localStorage.getItem(key(rel)) != null) {
    return true;
  }
  const dirPrefix = `${key(rel)}/`;
  for (let i = 0; i < localStorage.length; i += 1) {
    const item = localStorage.key(i);
    if (item?.startsWith(dirPrefix)) {
      return true;
    }
  }
  return false;
}

export function readJsonFile<T>(rel: string, fallback: T): T {
  const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(key(rel));
  if (!raw?.trim()) {
    return fallback;
  }
  return JSON.parse(raw) as T;
}

export function writeJsonFile(rel: string, data: unknown): void {
  localStorage.setItem(key(rel), `${JSON.stringify(data, null, 2)}\n`);
}

const blobUrls = new Map<string, string>();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return globalThis.btoa(binary);
}

function revokeBlob(rel: string): void {
  const prev = blobUrls.get(rel);
  if (prev) {
    URL.revokeObjectURL(prev);
    blobUrls.delete(rel);
  }
}

export function writeBytes(rel: string, bytes: Uint8Array): void {
  revokeBlob(rel);
  localStorage.setItem(key(rel), bytesToBase64(bytes));
}

export function audioPlayUri(rel: string): string | null {
  const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(key(rel));
  if (!raw) {
    return null;
  }
  const cached = blobUrls.get(rel);
  if (cached) {
    return cached;
  }
  const binary = globalThis.atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
  blobUrls.set(rel, url);
  return url;
}

export function deleteFile(rel: string): void {
  revokeBlob(rel);
  localStorage.removeItem(key(rel));
}

export function listFileNames(relDir: string): string[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  const dirPrefix = `${key(relDir)}/`;
  const names: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const item = localStorage.key(i);
    if (!item?.startsWith(dirPrefix)) {
      continue;
    }
    const rest = item.slice(dirPrefix.length);
    if (rest && !rest.includes('/')) {
      names.push(rest);
    }
  }
  return names;
}
