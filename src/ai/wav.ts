const TARGET_RATE = 16000;

function getAudioContextCtor(): typeof AudioContext {
  const g = globalThis as typeof globalThis & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctx = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctx) {
    throw new Error('当前浏览器不支持语音识别');
  }
  return Ctx;
}

function toMono(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const out = new Float32Array(length);
  for (let c = 0; c < channels; c += 1) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i += 1) {
      out[i] += data[i];
    }
  }
  if (channels > 1) {
    for (let i = 0; i < length; i += 1) {
      out[i] /= channels;
    }
  }
  return out;
}

function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) {
    return input;
  }
  const ratio = fromRate / toRate;
  const length = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio) || start + 1);
    let sum = 0;
    for (let j = start; j < end; j += 1) {
      sum += input[j];
    }
    out[i] = end > start ? sum / (end - start) : input[Math.min(start, input.length - 1)] ?? 0;
  }
  return out;
}

function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return bytes;
}

export async function audioBlobToWav(blob: Blob): Promise<Uint8Array> {
  if (blob.size < 64) {
    throw new Error('没有录到声音，请再说一遍');
  }
  const Ctx = getAudioContextCtor();
  const ctx = new Ctx();
  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const decoded = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
    const samples = resample(toMono(decoded), decoded.sampleRate, TARGET_RATE);
    if (samples.length < TARGET_RATE * 0.35) {
      throw new Error('说得太短了，请按住「说」把话讲完');
    }
    return encodeWav(samples, TARGET_RATE);
  } catch (e) {
    if (e instanceof Error && (e.message.includes('录到') || e.message.includes('太短'))) {
      throw e;
    }
    throw new Error('没有听清，请再说一遍');
  } finally {
    await ctx.close().catch(() => undefined);
  }
}
