import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Button from '@/components/ui/Button';
import { usePageT } from '@/config/locales';
import { useScreenRecorder } from '@/components/feedback/useScreenRecorder';
import { MAX_RECORDING_SECONDS, recorderWindowMessage, type RecorderWindowMessage } from '@/lib/problemReport';

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * The recorder window: opened by "Report a problem" when the page it is on is framed by a site
 * that does not let its frames capture the screen. This window is nobody's frame, so it can.
 *
 * It only records. It tells the page that opened it when recording starts, takes "stop" from it,
 * and hands it the video; the preview, the description and the upload all stay on that page.
 * Everything is said to our own origin only, so the framing site hears none of it.
 */
export default function ReportRecorderPage() {
  const t = usePageT();
  const [phase, setPhase] = useState<'ready' | 'refused' | 'done'>('ready');
  const [orphan, setOrphan] = useState(false);

  const tell = useCallback((message: RecorderWindowMessage) => {
    try {
      window.opener?.postMessage(message, window.location.origin);
    } catch {
      /* the page that opened us has gone */
    }
  }, []);

  const recorder = useScreenRecorder(({ blob, hitLimit, surface }) => {
    tell({ type: 'problem-recorder', event: 'finished', blob, hitLimit, surface });
    setPhase('done');
    window.close();
  });
  const { recording, surface, stop } = recorder;

  useEffect(() => setOrphan(!window.opener), []);

  useEffect(() => {
    if (recording) tell({ type: 'problem-recorder', event: 'started', surface });
  }, [recording, surface, tell]);

  useEffect(() => {
    const heard = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.opener) return;
      if (recorderWindowMessage(event.data)?.event === 'stop') stop();
    };
    window.addEventListener('message', heard);
    return () => window.removeEventListener('message', heard);
  }, [stop]);

  const start = async () => {
    setPhase('ready');
    if (!(await recorder.start())) setPhase('refused');
  };

  const limit = clock(MAX_RECORDING_SECONDS);
  return (
    <>
      <Head>
        <title>{t('report.recorderTitle')}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main className="min-h-screen bg-white text-gray-900 p-6 space-y-4">
        <h1 className="text-lg font-medium">{t('report.recorderTitle')}</h1>
        {orphan ? (
          <p className="text-sm text-gray-700">{t('report.recorderOrphan')}</p>
        ) : phase === 'done' ? (
          <p role="status" className="text-sm text-gray-700">{t('report.recorderDone')}</p>
        ) : recording ? (
          <>
            <p role="status" className="text-sm font-medium text-red-700 tabular-nums">
              {t('report.recordingFor', { elapsed: clock(recorder.seconds), limit })}
            </p>
            <p className="text-sm text-gray-700">{t('report.recorderLive')}</p>
            {surface === 'browser' && <p className="text-sm text-amber-900 bg-amber-100 rounded-md p-3">{t('report.tabOnly')}</p>}
            <Button type="button" onClick={stop}>{t('report.stop')}</Button>
          </>
        ) : (
          <>
            {phase === 'refused' && <p role="alert" className="text-sm text-red-600">{t('report.recorderRefusedHere')}</p>}
            <p className="text-sm text-gray-700">{t('report.recorderIntro', { limit })}</p>
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">{t('report.warning')}</p>
            <Button type="button" onClick={start}>{t('report.start')}</Button>
          </>
        )}
      </main>
    </>
  );
}
