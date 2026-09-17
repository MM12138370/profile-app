import { unzipSync, zipSync, type Zippable } from 'fflate';

import type { UserRecord } from '../types';
import {
  audioDirPath,
  audioPath,
  banksDirPath,
  deleteDir,
  ensureDir,
  jobsDirPath,
  listFileNames,
  masterPath,
  nowIso,
  pathExists,
  readBytes,
  readText,
  resumesDirPath,
  userDirPath,
  writeBytes,
  writeText,
} from './io';

export const ARCHIVE_KIND = 'zhimian.archive';
export const ARCHIVE_EXT = '.zm';
export const ARCHIVE_MIME = 'application/x-zhimian-archive';
export const ARCHIVE_UTI = 'com.zhimian.archive';

const MANIFEST_FILE = 'zhimian.json';
const PACK_PATH = /^(master\.json|(resumes|jobs|banks)\/[^/]+\.json|audio\/[^/]+\.mp3)$/;

export type ArchiveManifest = {
  kind: typeof ARCHIVE_KIND;
  exportedAt: string;
  user: {
    username: string;
    nickname?: string;
  };
};

export type ArchivePack = {
  manifest: ArchiveManifest;
  files: Record<string, Uint8Array>;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeText(text: string): Uint8Array {
  return textEncoder.encode(text);
}

function decodeText(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

function readyWorkspace(hashid: string): void {
  ensureDir(userDirPath(hashid));
  ensureDir(resumesDirPath(hashid));
  ensureDir(jobsDirPath(hashid));
  ensureDir(banksDirPath(hashid));
  ensureDir(audioDirPath(hashid));
}

function normalizeZipPath(name: string): string {
  return name.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function isPackPath(rel: string): boolean {
  return PACK_PATH.test(rel);
}

function rewriteExportJson(text: string): string {
  return text.replace(/"audio"\s*:\s*"datas\/[A-Za-z0-9]+\/audio\/([^"]+)\.mp3"/g, '"audio": "audio/$1.mp3"');
}

function rewriteImportJson(text: string, hashid: string): string {
  return text.replace(
    /"audio"\s*:\s*"(?:datas\/[A-Za-z0-9]+\/)?audio\/([^"]+)\.mp3"/g,
    (_match, id: string) => `"audio": "${audioPath(hashid, id)}"`,
  );
}

function toZippable(files: Record<string, Uint8Array>): Zippable {
  const root: Zippable = {};
  for (const [path, data] of Object.entries(files)) {
    const parts = path.split('/');
    let cursor = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      const current = cursor[part];
      if (!current || current instanceof Uint8Array || Array.isArray(current)) {
        const folder: Zippable = {};
        cursor[part] = folder;
        cursor = folder;
      } else {
        cursor = current;
      }
    }
    const name = parts[parts.length - 1];
    cursor[name] = [data, { level: name.endsWith('.mp3') ? 0 : 6 }];
  }
  return root;
}

function addPackedFile(files: Record<string, Uint8Array>, rel: string, full: string): void {
  if (rel.endsWith('.mp3')) {
    const bytes = readBytes(full);
    if (bytes) {
      files[rel] = bytes;
    }
    return;
  }
  const text = readText(full);
  if (text != null) {
    files[rel] = encodeText(rewriteExportJson(text));
  }
}

function collectUserFiles(hashid: string): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const master = masterPath(hashid);
  if (pathExists(master)) {
    addPackedFile(files, 'master.json', master);
  }
  for (const [folder, dir] of [
    ['resumes', resumesDirPath(hashid)],
    ['jobs', jobsDirPath(hashid)],
    ['banks', banksDirPath(hashid)],
  ] as const) {
    for (const name of listFileNames(dir)) {
      const rel = `${folder}/${name}`;
      if (isPackPath(rel)) {
        addPackedFile(files, rel, `${dir}/${name}`);
      }
    }
  }
  const audioDir = audioDirPath(hashid);
  for (const name of listFileNames(audioDir)) {
    const rel = `audio/${name}`;
    if (isPackPath(rel)) {
      addPackedFile(files, rel, `${audioDir}/${name}`);
    }
  }
  return files;
}

export function archiveFileName(username: string): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const safe = username.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'zhimian';
  return `${safe}-${stamp}${ARCHIVE_EXT}`;
}

export function packUserArchive(user: UserRecord): { fileName: string; bytes: Uint8Array } {
  const files = collectUserFiles(user.hashid);
  const manifest: ArchiveManifest = {
    kind: ARCHIVE_KIND,
    exportedAt: nowIso(),
    user: user.nickname?.trim()
      ? { username: user.username, nickname: user.nickname.trim() }
      : { username: user.username },
  };
  const zipped = zipSync({
    ...toZippable(files),
    [MANIFEST_FILE]: [encodeText(`${JSON.stringify(manifest, null, 2)}\n`), { level: 6 }],
  });
  return { fileName: archiveFileName(user.username), bytes: zipped };
}

function readManifest(files: Record<string, Uint8Array>): ArchiveManifest {
  const raw = files[MANIFEST_FILE];
  if (!raw) {
    throw new Error('不是职面存档');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeText(raw));
  } catch {
    throw new Error('存档已损坏');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('不是职面存档');
  }
  const rec = parsed as Record<string, unknown>;
  if (rec.kind !== ARCHIVE_KIND) {
    throw new Error('不是职面存档');
  }
  const user = rec.user && typeof rec.user === 'object' ? (rec.user as Record<string, unknown>) : {};
  const username = String(user.username ?? '').trim();
  if (!username) {
    throw new Error('存档里没有账号');
  }
  const nickname = String(user.nickname ?? '').trim();
  return {
    kind: ARCHIVE_KIND,
    exportedAt: String(rec.exportedAt ?? ''),
    user: nickname ? { username, nickname } : { username },
  };
}

export function parseArchive(bytes: Uint8Array): ArchivePack {
  if (bytes.byteLength < 4) {
    throw new Error('不是职面存档');
  }
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(bytes);
  } catch {
    throw new Error('不是职面存档');
  }
  const files: Record<string, Uint8Array> = {};
  for (const [rawName, data] of Object.entries(unzipped)) {
    const rel = normalizeZipPath(rawName);
    if (!rel || rel.includes('..') || rel.endsWith('/')) {
      continue;
    }
    if (rel === MANIFEST_FILE || isPackPath(rel)) {
      files[rel] = data;
    }
  }
  return { manifest: readManifest(files), files };
}

export function writeArchive(hashid: string, pack: ArchivePack): void {
  deleteDir(userDirPath(hashid));
  readyWorkspace(hashid);
  for (const [rel, data] of Object.entries(pack.files)) {
    if (rel === MANIFEST_FILE || !isPackPath(rel)) {
      continue;
    }
    const dest = rel.startsWith('audio/')
      ? audioPath(hashid, rel.slice('audio/'.length).replace(/\.mp3$/, ''))
      : `${userDirPath(hashid)}/${rel}`;
    if (rel.endsWith('.mp3')) {
      writeBytes(dest, data);
      continue;
    }
    writeText(dest, rewriteImportJson(decodeText(data), hashid));
  }
}
