import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_RECORDING_SECONDS, pickRecorderMimeType } from '@/lib/problemReport';

export interface ScreenRecording {
  blob: Blob;
  seconds: number;
  /** True when the three-minute limit stopped it, so the person can be told. */
  hitLimit: boolean;
}

/**
 * The in-page screen recorder: getDisplayMedia into a MediaRecorder.
 *
 * It records pixels, so whatever is on screen is in it, including the Privy and Stripe frames
 * our own logs cannot see into. No audio. It stops when asked, when the person ends sharing from
 * the browser's own bar, or at three minutes.
 *
 * `start` resolves false when the browser or the person refused, so the caller can offer the
 * file upload instead; it never throws.
 */
export function useScreenRecorder(onFinished: (recording: ScreenRecording) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hitLimit = useRef(false);
  const finished = useRef(onFinished);
  finished.current = onFinished;

  const stop = useCallback(() => {
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
  }, []);

  const release = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    recorder.current = null;
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    let media: MediaStream;
    try {
      // preferCurrentTab is Chromium's: the picker opens on this tab. Others ignore it.
      const options = { video: { frameRate: 15 }, audio: false, preferCurrentTab: true } as DisplayMediaStreamOptions;
      media = await navigator.mediaDevices.getDisplayMedia(options);
    } catch {
      return false;
    }
    try {
      const mimeType = pickRecorderMimeType((type) => MediaRecorder.isTypeSupported(type));
      const made = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      const startedAt = Date.now();
      hitLimit.current = false;
      made.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      made.onstop = () => {
        const blob = new Blob(chunks, { type: made.mimeType || mimeType || 'video/webm' });
        release();
        setRecording(false);
        finished.current({ blob, seconds: Math.round((Date.now() - startedAt) / 1000), hitLimit: hitLimit.current });
      };
      // The browser's own "Stop sharing" ends the track without telling the recorder.
      media.getVideoTracks().forEach((track) => track.addEventListener('ended', stop));
      stream.current = media;
      recorder.current = made;
      made.start(1000);
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setSeconds(elapsed);
        if (elapsed >= MAX_RECORDING_SECONDS) {
          hitLimit.current = true;
          stop();
        }
      }, 500);
      return true;
    } catch {
      media.getTracks().forEach((track) => track.stop());
      release();
      return false;
    }
  }, [release, stop]);

  // Leaving the page mid-recording must not leave the screen shared.
  useEffect(() => release, [release]);

  return { recording, seconds, start, stop };
}
