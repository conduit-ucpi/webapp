import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, routeParam } from '@/lib/server/serviceProxy';
import { clientAddress, rateLimiter } from '@/lib/server/publicFormLimit';
import {
  finishMultipart,
  readRecord,
  recordKey,
  recordingsConfigured,
  remove,
  signedViewUrl,
  storedSize,
  writeRecord,
} from '@/lib/server/recordingStore';
import { RECORDING_ID, notify, type RecordingRecord } from '@/lib/server/problemRecording';

/**
 * Step 3 of "Report a problem": the browser says its upload is done. This confirms the video is
 * really in the bucket at the size that was declared, and only then tells us, with links that
 * work for seven days.
 *
 * Nothing the browser says here is believed: there is no body. Whether the upload happened is
 * read from the bucket, and a large upload's parts are listed there, not sent by the page.
 *
 * Safe to call again. A recording we were already told about answers 200 and sends nothing; one
 * whose notification failed is tried again, which is why the page retries on a 502.
 */

export const config = {
  api: { bodyParser: { sizeLimit: '1kb' } },
};

export const allow = rateLimiter(60, 60 * 60 * 1000);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  if (!recordingsConfigured()) return res.status(503).json({ error: 'Recordings cannot be sent right now. Try again later.' });
  if (!allow(clientAddress(req))) return res.status(429).json({ error: 'Too many requests from here. Try again in an hour.' });

  const id = routeParam(req, 'id');
  if (!id || !RECORDING_ID.test(id)) return res.status(404).json({ error: 'No such recording.' });

  try {
    const record = await readRecord<RecordingRecord>(id);
    if (!record) return res.status(404).json({ error: 'No such recording.' });
    if (record.status === 'notified') return res.status(200).json({ received: true });

    if (record.upload.kind === 'multipart' && !record.upload.assembled) {
      try {
        await finishMultipart(record.video.key, record.upload.uploadId);
      } catch {
        return res.status(409).json({ error: 'The upload is not finished.' });
      }
      record.upload.assembled = true;
      await writeRecord(id, record);
    }

    const size = await storedSize(record.video.key);
    if (size === null) return res.status(409).json({ error: 'The upload is not finished.' });
    // A single upload's length is in its signature. A multipart one's is not, so it is checked
    // here, and anything that is not the file that was declared is not kept.
    if (size !== record.video.size) {
      await remove(record.video.key);
      await remove(recordKey(id));
      console.warn(`PROBLEM RECORDING ${id} removed: ${size} bytes arrived, ${record.video.size} were declared`);
      return res.status(400).json({ error: 'The upload did not match the recording. Send it again.' });
    }

    if (record.status === 'uploading') {
      record.status = 'uploaded';
      record.completedAt = new Date().toISOString();
      await writeRecord(id, record);
    }

    const told = await notify(record, await signedViewUrl(record.video.key), await signedViewUrl(recordKey(id)));
    console.log(
      `PROBLEM RECORDING ${id} received: ${size} bytes ${record.video.contentType} source ${record.source} ` +
        `user ${record.account.userId ?? 'none'} notified ${told}`
    );
    if (!told) return res.status(502).json({ error: 'Your recording arrived, but we could not be told. Try again in a minute.' });

    record.status = 'notified';
    await writeRecord(id, record);
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error(`PROBLEM RECORDING ${id} could not be completed: ${error instanceof Error ? error.message : 'unknown error'}`);
    return res.status(502).json({ error: 'The recording could not be confirmed. Try again in a minute.' });
  }
}
