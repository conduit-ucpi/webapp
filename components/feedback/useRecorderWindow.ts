import { useCallback, useEffect, useRef, useState } from 'react';
import { RECORDER_WINDOW_PATH, capturedSurface, recorderWindowMessage, type CapturedSurface, type RecorderWindowMessage } from '@/lib/problemReport';

export interface WindowRecording {
  blob: Blob;
  hitLimit: boolean;
  surface: CapturedSurface | null;
}

/**
 * Recording through the recorder window (see RECORDER_WINDOW_PATH), for a page that is framed by
 * a site which does not let its frames capture the screen.
 *
 * `open` must be called from a click, or the browser blocks the window; it answers false when it
 * was blocked. The person then presses Start in that window (the browser wants a click there
 * too), so there is a `waiting` state before `recording`. `stop` asks the window to finish; the
 * video arrives through `onFinished`. Closing the window without finishing calls `onAbandoned`.
 *
 * Messages are only believed from our own origin and from the very window we opened.
 */
export function useRecorderWindow(onFinished: (recording: WindowRecording) => void, onAbandoned: () => void) {
  const [state, setState] = useState<'idle' | 'waiting' | 'recording'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [surface, setSurface] = useState<CapturedSurface | null>(null);
  const opened = useRef<Window | null>(null);
  const startedAt = useRef<number | null>(null);
  const finished = useRef(onFinished);
  finished.current = onFinished;
  const abandoned = useRef(onAbandoned);
  abandoned.current = onAbandoned;

  const open = useCallback((query: string): boolean => {
    const made = window.open(`${RECORDER_WINDOW_PATH}/${query}`, 'problem-recorder', 'popup,width=460,height=560');
    if (!made) return false;
    opened.current = made;
    startedAt.current = null;
    setSeconds(0);
    setSurface(null);
    setState('waiting');
    return true;
  }, []);

  const stop = useCallback(() => {
    const message: RecorderWindowMessage = { type: 'problem-recorder', event: 'stop' };
    opened.current?.postMessage(message, window.location.origin);
  }, []);

  const cancel = useCallback(() => {
    opened.current?.close();
    opened.current = null;
    setState('idle');
  }, []);

  const active = state !== 'idle';
  useEffect(() => {
    if (!active) return;
    let done = false;
    const heard = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== opened.current) return;
      const message = recorderWindowMessage(event.data);
      if (message?.event === 'started') {
        startedAt.current = Date.now();
        setSurface(capturedSurface(message.surface));
        setState('recording');
      } else if (message?.event === 'finished' && message.blob instanceof Blob) {
        done = true;
        opened.current = null;
        setState('idle');
        finished.current({ blob: message.blob, hitLimit: !!message.hitLimit, surface: capturedSurface(message.surface) });
      }
    };
    window.addEventListener('message', heard);
    const tick = setInterval(() => {
      if (startedAt.current) setSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
      if (!opened.current?.closed) return;
      // Closed. Its last message, if it sent one, is already queued: let that land first.
      clearInterval(tick);
      setTimeout(() => {
        if (done) return;
        opened.current = null;
        setState('idle');
        abandoned.current();
      }, 300);
    }, 500);
    return () => {
      done = true;
      window.removeEventListener('message', heard);
      clearInterval(tick);
    };
  }, [active]);

  return { state, seconds, surface, open, stop, cancel };
}
