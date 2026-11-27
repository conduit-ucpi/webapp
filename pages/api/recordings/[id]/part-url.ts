import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, routeParam } from '@/lib/server/serviceProxy';
import { clientAddress, rateLimiter } from '@/lib/server/publicFormLimit';
import { partCount } from '@/lib/problemReport';
import { readRecord, recordingsConfigured, signedPartUrl } from '@/lib/server/recordingStore';
import { RECORDING_ID, type RecordingRecord } from '@/lib/server/problemRecording';

/**
 * Where to PUT one part of a large recording. Asked for part by part, just before each is sent,
 * rather than all at once when the recording is created: a URL lives 15 minutes, and 500 MB over a
 * phone connection takes longer than that.
 *
 * Public like the rest of /api/recordings. The recording id, which only the browser that created
 * it knows, is what lets a caller add to it, and only until it is completed.
 */

export const config = {
  api: { bodyParser: { sizeLimit: '1kb' } },
};

/** 63 parts is one 500 MB file; this leaves room for retries and a few recordings. */
export const allow = rateLimiter(1000, 60 * 60 * 1000);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  if (!recordingsConfigured()) return res.status(503).json({ error: 'Recordings cannot be sent right now. Try again later.' });
  if (!allow(clientAddress(req))) return res.status(429).json({ error: 'Too many requests from here. Try again in an hour.' });

  const id = routeParam(req, 'id');
  if (!id || !RECORDING_ID.test(id)) return res.status(404).json({ error: 'No such recording.' });

  try {
    const record = await readRecord<RecordingRecord>(id);
    if (!record) return res.status(404).json({ error: 'No such recording.' });
    if (record.upload.kind !== 'multipart' || record.upload.assembled || record.status !== 'uploading') {
      return res.status(409).json({ error: 'This recording is not waiting for parts.' });
    }
    const partNumber = req.body?.partNumber;
    if (typeof partNumber !== 'number' || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > partCount(record.video.size)) {
      return res.status(400).json({ error: 'partNumber is out of range.' });
    }
    return res.status(200).json({ url: await signedPartUrl(record.video.key, record.upload.uploadId, partNumber) });
  } catch (error) {
    console.error(`PROBLEM RECORDING ${id} part could not be signed: ${error instanceof Error ? error.message : 'unknown error'}`);
    return res.status(502).json({ error: 'The upload could not continue. Try again in a minute.' });
  }
}
