const PREFIX = 'zhimian.fs:';

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

export function deleteFile(rel: string): void {
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

export function nowIso(): string {
  return new Date().toISOString();
}
