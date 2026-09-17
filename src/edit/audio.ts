import { synthesizeSpeech } from '../ai/speech';
import { prepareAudioRel } from '../storage';
import { deleteFile } from '../storage/io';
import type { AiSettings, QaTurn } from '../types';

export async function writeQaAudio(hashid: string, turn: QaTurn, settings: AiSettings): Promise<QaTurn> {
  if (!turn.question.trim()) {
    throw new Error('请先填写问题');
  }
  const rel = prepareAudioRel(hashid, turn.id);
  await synthesizeSpeech(turn.question, settings.ttsVoice, settings, rel);
  return { ...turn, audio: rel, audioText: turn.question };
}

export function dropQaAudio(turns: Array<{ audio?: string }>): void {
  for (const turn of turns) {
    if (turn.audio) {
      deleteFile(turn.audio);
    }
  }
}
