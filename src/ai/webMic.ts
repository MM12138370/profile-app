type Session = {
  recorder: MediaRecorder;
  chunks: Blob[];
  stream: MediaStream;
};

let session: Session | null = null;

function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') {
    return undefined;
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((item) => MediaRecorder.isTypeSupported(item));
}

export async function startWebMic(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前浏览器不支持录音');
  }
  if (session) {
    return;
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
  const mimeType = pickMime();
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });
  session = { recorder, chunks, stream };
  try {
    recorder.start(200);
  } catch (error) {
    session = null;
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }
}

export async function stopWebMic(): Promise<Blob> {
  const current = session;
  session = null;
  if (!current) {
    throw new Error('没有录到声音');
  }
  const blob = await new Promise<Blob>((resolve, reject) => {
    const finish = () => {
      const type = current.recorder.mimeType || current.chunks[0]?.type || 'audio/webm';
      resolve(new Blob(current.chunks, { type }));
    };
    current.recorder.addEventListener('stop', finish, { once: true });
    current.recorder.addEventListener('error', () => reject(new Error('录音失败')), { once: true });
    if (current.recorder.state === 'inactive') {
      finish();
      return;
    }
    current.recorder.stop();
  });
  current.stream.getTracks().forEach((track) => track.stop());
  return blob;
}

export function discardWebMic(): void {
  const current = session;
  session = null;
  if (!current) {
    return;
  }
  try {
    if (current.recorder.state !== 'inactive') {
      current.recorder.stop();
    }
  } catch {
    // already stopped
  }
  current.stream.getTracks().forEach((track) => track.stop());
}
