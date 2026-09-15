import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { loadAiSettings } from '../storage';
import { speechConfigured, type AiSettings } from '../types';
import { audioBlobToWav } from './wav';

const SPEECH_ORIGIN =
  Platform.OS === 'web' ? '/__openspeech' : 'https://openspeech.bytedance.com';
const TTS_URL = `${SPEECH_ORIGIN}/api/v3/tts/unidirectional`;
const ASR_FLASH_URL = `${SPEECH_ORIGIN}/api/v3/auc/bigmodel/recognize/flash`;
const ASR_SUBMIT_URL = `${SPEECH_ORIGIN}/api/v3/auc/bigmodel/submit`;
const ASR_QUERY_URL = `${SPEECH_ORIGIN}/api/v3/auc/bigmodel/query`;

type JsonRec = Record<string, unknown>;

function requireSpeech(settings: AiSettings): void {
  if (!speechConfigured(settings)) {
    throw new Error('请先在设置 › 连接大模型 里填写豆包语音凭证');
  }
}

function speechHeaders(settings: AiSettings, resourceId: string, requestId: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Api-Resource-Id': resourceId,
    'X-Api-Request-Id': requestId,
    'X-Api-Sequence': '-1',
    'X-Api-Key': settings.speechApiKey.trim() || settings.apiKey.trim(),
  };
}

function parseJsonObjects(text: string): JsonRec[] {
  const out: JsonRec[] = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && text[i] !== '{') {
      i += 1;
    }
    if (i >= text.length) {
      break;
    }
    let depth = 0;
    let inStr = false;
    let esc = false;
    const start = i;
    for (; i < text.length; i += 1) {
      const ch = text[i];
      if (inStr) {
        if (esc) {
          esc = false;
        } else if (ch === '\\') {
          esc = true;
        } else if (ch === '"') {
          inStr = false;
        }
        continue;
      }
      if (ch === '"') {
        inStr = true;
      } else if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          const parsed = JSON.parse(text.slice(start, i + 1)) as unknown;
          if (parsed && typeof parsed === 'object') {
            out.push(parsed as JsonRec);
          }
          i += 1;
          break;
        }
      }
    }
  }
  return out;
}

function b64ToBytes(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function bytesToBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return globalThis.btoa(binary);
}

function speechDir(): Directory {
  const dir = new Directory(Paths.cache, 'zhimian-speech');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

let lastWebAudioUrl = '';

function writeAudioFile(bytes: Uint8Array, ext: string): string {
  if (Platform.OS === 'web') {
    if (lastWebAudioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(lastWebAudioUrl);
    }
    const mime = ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : `audio/${ext}`;
    lastWebAudioUrl = URL.createObjectURL(new Blob([bytesToBuffer(bytes)], { type: mime }));
    return lastWebAudioUrl;
  }
  const file = new File(speechDir(), `tts-${randomUUID()}.${ext}`);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(bytes);
  return file.uri;
}

async function readAudioPayload(fileUri: string): Promise<JsonRec> {
  if (Platform.OS === 'web' || fileUri.startsWith('blob:') || fileUri.startsWith('data:')) {
    const response = await fetch(fileUri);
    const blob = await response.blob();
    const wav = await audioBlobToWav(blob);
    return {
      data: bytesToBase64(wav),
      format: 'wav',
      rate: 16000,
      bits: 16,
      channel: 1,
    };
  }
  const file = new File(fileUri);
  if (!file.exists) {
    throw new Error('没有录到声音');
  }
  const data = await file.base64();
  if (!data) {
    throw new Error('录音是空的，请再说一遍');
  }
  return { data, format: audioFormat(fileUri) };
}

function headerStatus(response: Response): string {
  return response.headers.get('X-Api-Status-Code') ?? '';
}

function asrTextFrom(data: unknown): string {
  if (!data || typeof data !== 'object') {
    return '';
  }
  const rec = data as JsonRec;
  const result = rec.result && typeof rec.result === 'object' ? (rec.result as JsonRec) : rec;
  const direct = String(result.text ?? rec.text ?? '').trim();
  if (direct) {
    return direct;
  }
  const utterances = Array.isArray(result.utterances) ? result.utterances : [];
  return utterances
    .map((item) => (item && typeof item === 'object' ? String((item as JsonRec).text ?? '') : ''))
    .join('')
    .trim();
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<{ response: Response; raw: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    return { response, raw };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('语音请求超时，请稍后重试');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function synthesizeSpeech(
  text: string,
  voice?: string,
  settingsOverride?: AiSettings,
): Promise<string> {
  const settings = settingsOverride ?? (await loadAiSettings());
  requireSpeech(settings);
  const input = text.trim();
  if (!input) {
    throw new Error('没有可朗读的内容');
  }
  const speaker = (voice || settings.ttsVoice).trim();
  if (!speaker) {
    throw new Error('请先选择音色');
  }
  const requestId = randomUUID();
  const resourceId = settings.ttsResourceId.trim() || 'seed-tts-2.0';
  const { response, raw } = await postJson(TTS_URL, speechHeaders(settings, resourceId, requestId), {
    user: { uid: 'zhimian' },
    req_params: {
      text: input,
      speaker,
      audio_params: {
        format: 'mp3',
        sample_rate: 24000,
      },
    },
  });
  const chunks = parseJsonObjects(raw);
  const audio: Uint8Array[] = [];
  let errorMessage = '';
  for (const chunk of chunks) {
    const code = Number(chunk.code);
    const message = String(chunk.message ?? chunk.msg ?? '').trim();
    if (typeof chunk.data === 'string' && chunk.data) {
      audio.push(b64ToBytes(chunk.data));
    }
    if (code && code !== 0 && code !== 20000000) {
      errorMessage = message || `语音合成失败 ${code}`;
    }
  }
  if (!audio.length) {
    const status = headerStatus(response);
    throw new Error(errorMessage || (raw.slice(0, 180) || `语音合成失败${status ? ` ${status}` : ''}`));
  }
  return writeAudioFile(concatBytes(audio), 'mp3');
}

function audioFormat(uri: string): string {
  const name = uri.split('?')[0]?.toLowerCase() ?? '';
  if (name.endsWith('.wav')) {
    return 'wav';
  }
  if (name.endsWith('.mp3')) {
    return 'mp3';
  }
  if (name.endsWith('.ogg') || name.endsWith('.opus')) {
    return 'ogg';
  }
  if (name.endsWith('.m4a') || name.endsWith('.aac')) {
    return 'mp3';
  }
  return 'wav';
}

async function transcribeFlash(settings: AiSettings, resourceId: string, audio: JsonRec): Promise<string> {
  const requestId = randomUUID();
  const { response, raw } = await postJson(ASR_FLASH_URL, speechHeaders(settings, resourceId, requestId), {
    user: { uid: 'zhimian' },
    audio,
    request: {
      model_name: 'bigmodel',
      enable_itn: true,
      enable_punc: true,
    },
  });
  const status = headerStatus(response);
  let data: unknown = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }
  const text = asrTextFrom(data);
  if (text) {
    return text;
  }
  if (status && status !== '20000000') {
    throw new Error(`语音识别失败 ${status}`);
  }
  throw new Error(raw.slice(0, 180) || '没有识别到内容，请再说一遍');
}

async function transcribeSubmit(settings: AiSettings, resourceId: string, audio: JsonRec): Promise<string> {
  const requestId = randomUUID();
  const headers = speechHeaders(settings, resourceId, requestId);
  const submitted = await postJson(ASR_SUBMIT_URL, headers, {
    user: { uid: 'zhimian' },
    audio,
    request: {
      model_name: 'bigmodel',
      enable_itn: true,
      enable_punc: true,
    },
  });
  const submitStatus = headerStatus(submitted.response);
  if (submitStatus && !submitStatus.startsWith('200000')) {
    throw new Error(`语音识别提交失败 ${submitStatus}`);
  }
  const logId = submitted.response.headers.get('X-Tt-Logid') ?? '';
  const queryHeaders = {
    ...headers,
    ...(logId ? { 'X-Tt-Logid': logId } : {}),
  };
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const queried = await postJson(ASR_QUERY_URL, queryHeaders, {});
    const status = headerStatus(queried.response);
    if (status === '20000001' || status === '20000002') {
      continue;
    }
    let data: unknown = {};
    try {
      data = queried.raw ? JSON.parse(queried.raw) : {};
    } catch {
      data = {};
    }
    const text = asrTextFrom(data);
    if (text) {
      return text;
    }
    if (status === '20000000') {
      throw new Error('没有识别到内容，请再说一遍');
    }
    throw new Error(status ? `语音识别失败 ${status}` : queried.raw.slice(0, 180) || '语音识别失败');
  }
  throw new Error('语音识别超时，请稍后重试');
}

export async function transcribeSpeech(fileUri: string, settingsOverride?: AiSettings): Promise<string> {
  const settings = settingsOverride ?? (await loadAiSettings());
  requireSpeech(settings);
  const audio = await readAudioPayload(fileUri);
  const resourceId = settings.sttResourceId.trim() || 'volc.bigasr.auc_turbo';
  if (resourceId.includes('turbo') || resourceId.includes('flash')) {
    return transcribeFlash(settings, resourceId, audio);
  }
  return transcribeSubmit(settings, resourceId, audio);
}
