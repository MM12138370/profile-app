import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

export type SpeakState = 'idle' | 'playing' | 'paused';

export function useSpeakPlayer() {
  const player = useAudioPlayer(null, { keepAudioSessionActive: true });
  const status = useAudioPlayerStatus(player);
  const [speak, setSpeak] = useState<SpeakState>('idle');
  const gen = useRef(0);
  const speakRef = useRef(speak);
  speakRef.current = speak;

  const stop = useCallback(() => {
    gen.current += 1;
    player.pause();
    void player.seekTo(0);
    setSpeak('idle');
  }, [player]);

  const pause = useCallback(() => {
    player.pause();
    setSpeak('paused');
  }, [player]);

  const play = useCallback(
    async (uri: string) => {
      const token = (gen.current += 1);
      setSpeak('playing');
      try {
        player.pause();
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        player.replace({ uri });
        const start = Date.now();
        while (!player.isLoaded && Date.now() - start < 4000) {
          if (token !== gen.current || speakRef.current !== 'playing') {
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
        if (token === gen.current && speakRef.current === 'playing') {
          player.play();
        }
      } catch (error) {
        if (token === gen.current) {
          setSpeak('idle');
          throw error;
        }
      }
    },
    [player],
  );

  const resume = useCallback(
    (uri?: string | null) => {
      setSpeak('playing');
      if (player.isLoaded) {
        player.play();
        return;
      }
      if (uri) {
        void play(uri);
      }
    },
    [play, player],
  );

  useEffect(() => {
    if (status.didJustFinish) {
      setSpeak('idle');
    }
  }, [status.didJustFinish]);

  return { speak, play, pause, resume, stop };
}
