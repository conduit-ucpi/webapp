import { randomUUID } from 'crypto';
import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard } from '@/lib/server/serviceProxy';
import { clientAddress, rateLimiter } from '@/lib/server/publicFormLimit';
import { signedInAccount } from '@/lib/server/signedInAccount';
import {
  MAX_FILE_BYTES,
  PART_BYTES,
  extensionFor,
  isEmail,
  isMultipart,
  partCount,
  videoContentType,
  type CreateRecordingResponse,
} from '@/lib/problemReport';
import { recordingsConfigured, signedUploadUrl, startMultipart, videoKey, writeRecord } from '@/lib/server/recordingStore';
import { cleanDescription, cleanReported, notificationsConfigured, requestFacts, type RecordingRecord } from '@/lib/server/problemRecording';

/**
 * Step 1 of "Report a problem": the browser says what it is about to send (never the video), and
 * gets a recording id and where to PUT the file. Step 2 is the browser's own upload to the bucket;
 * step 3 is POST /api/recordings/{id}/complete.
 *
 * ⚠️ PUBLIC: signed in or not, because the people this is for are often stuck before or during
 *    sign-in. What bounds it: a rate limit per address, a signed URL that takes exactly the
 *    declared type and length and dies in 15 minutes, a 500 MB ceiling, and a private bucket that
 *    deletes after 90 days. The id is random and is the only handle on the recording.
 *
 * ⚠️ THE ACCOUNT IS LOOKED UP HERE, NEVER TAKEN FROM THE BROWSER (see signedInAccount). The rest
 *    of the context is the browser's word and is kept as such.
 *
 * Answers 503 when no bucket is configured, which is also how an environment has this turned off.
 */

export const config = {
  api: { bodyParser: { sizeLimit: '128kb' } },
};

/** Up to 10 recordings per address per hour. */
export const allow = rateLimiter(10, 60 * 60 * 1000);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  if (!recordingsConfigured() || !notificationsConfigured()) {
    return res.status(503).json({ error: 'Recordings cannot be sent right now. Try again later.' });
  }
  if (!allow(clientAddress(req))) {
    return res.status(429).json({ error: 'Too many recordings from here. Try again in an hour.' });
  }

  const b = req.body ?? {};
  const contentType = videoContentType(typeof b.contentType === 'string' ? b.contentType : null);
  if (!contentType) return res.status(400).json({ error: 'Only video files can be sent.' });
  if (typeof b.size !== 'number' || !Number.isInteger(b.size) || b.size <= 0) {
    return res.status(400).json({ error: 'size is required.' });
  }
  if (b.size > MAX_FILE_BYTES) return res.status(400).json({ error: 'The recording is too large. The limit is 500 MB.' });
  if (typeof b.contactEmail !== 'string' || b.contactEmail.length > 254 || !isEmail(b.contactEmail)) {
    return res.status(400).json({ error: 'A valid contactEmail is required.' });
  }
  if (b.source !== 'recorder' && b.source !== 'upload') return res.status(400).json({ error: 'source is required.' });

  const id = randomUUID();
  const key = videoKey(id, extensionFor(contentType));

  try {
    const multipart = isMultipart(b.size);
    const uploadId = multipart ? await startMultipart(key, contentType) : null;
    const record: RecordingRecord = {
      id,
      createdAt: new Date().toISOString(),
      status: 'uploading',
      video: { key, contentType, size: b.size },
      upload: uploadId ? { kind: 'multipart', uploadId } : { kind: 'single' },
      source: b.source,
      description: cleanDescription(b.description),
      contactEmail: b.contactEmail.trim(),
      account: await signedInAccount(req),
      reported: cleanReported(b),
      request: requestFacts(req),
    };
    await writeRecord(id, record);

    const body: CreateRecordingResponse = {
      id,
      upload: uploadId
        ? { kind: 'multipart', partBytes: PART_BYTES, partCount: partCount(b.size) }
        : { kind: 'single', url: await signedUploadUrl(key, contentType, b.size), headers: { 'Content-Type': contentType } },
    };
    return res.status(201).json(body);
  } catch (error) {
    console.error(`PROBLEM RECORDING could not be started: ${error instanceof Error ? error.message : 'unknown error'}`);
    return res.status(502).json({ error: 'The recording could not be started. Try again in a minute.' });
  }
}
