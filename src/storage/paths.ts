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

export function nowIso(): string {
  return new Date().toISOString();
}
