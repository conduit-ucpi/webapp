import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  type CompletedPart,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { recordingsConfig, recordingsConfigured } from '@/lib/server/recordingsConfig';

export { recordingsConfigured };

/**
 * Where "Report a problem" recordings are kept: one private bucket, spoken to over the S3 API,
 * which S3, Cloudflare R2 and MinIO all answer. Which one is configuration, never code:
 *
 *   RECORDINGS_S3_BUCKET             the bucket
 *   RECORDINGS_S3_ACCESS_KEY_ID      a key that can read and write that bucket and nothing else
 *   RECORDINGS_S3_SECRET_ACCESS_KEY
 *   RECORDINGS_S3_ENDPOINT           R2 or MinIO: https://<account>.r2.cloudflarestorage.com. Unset for AWS.
 *   RECORDINGS_S3_REGION             AWS region. Defaults to "auto", which is what R2 wants.
 *
 * ⚠️ VIDEO NEVER PASSES THROUGH THIS SERVER. It hands the browser a short-lived signed URL and the
 *    browser sends the file to the bucket itself. All this process reads or writes is the small
 *    JSON record beside each video.
 *
 * ⚠️ THREE THINGS ARE SET ON THE BUCKET, NOT HERE, because they are the bucket's to enforce:
 *    - private: no public access, no public bucket URL;
 *    - CORS: PUT from the site's origins, with the Content-Type header allowed;
 *    - lifecycle: delete everything under `recordings/` after 90 days, and abort unfinished
 *      multipart uploads after 1 day.
 *
 * Each recording is two objects: recordings/<id>/video.<ext> and recordings/<id>/record.json.
 */

/** How long the browser has to start a PUT with a URL it was given. */
export const UPLOAD_URL_SECONDS = 15 * 60;
/** How long the link in our notification works. Also the longest a SigV4 signature can last. */
export const VIEW_URL_SECONDS = 7 * 24 * 60 * 60;

interface Store {
  client: S3Client;
  bucket: string;
}

let cached: { key: string; store: Store } | null = null;

/** The store, or null when no bucket is configured (the routes then answer 503). */
function store(): Store | null {
  const config = recordingsConfig();
  if (!config) return null;
  const { bucket, accessKeyId, secretAccessKey, endpoint, region } = config;
  const key = [bucket, accessKeyId, endpoint, region].join('|');
  if (cached?.key !== key) {
    cached = {
      key,
      store: {
        bucket,
        client: new S3Client({
          region,
          endpoint,
          // A custom endpoint (R2, MinIO) addresses the bucket in the path, not as a subdomain.
          forcePathStyle: !!endpoint,
          credentials: { accessKeyId, secretAccessKey },
          // Otherwise the SDK signs a CRC32 checksum header into every upload URL, which a browser
          // PUT does not send and R2 does not accept.
          requestChecksumCalculation: 'WHEN_REQUIRED',
          responseChecksumValidation: 'WHEN_REQUIRED',
        }),
      },
    };
  }
  return cached.store;
}

function required(): Store {
  const s = store();
  if (!s) throw new Error('Recording storage is not configured');
  return s;
}

export const videoKey = (id: string, extension: string) => `recordings/${id}/video.${extension}`;
export const recordKey = (id: string) => `recordings/${id}/record.json`;

const notFound = (error: unknown): boolean => {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === 'NoSuchKey' || e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404;
};

/**
 * A URL the browser can PUT exactly this file to: this key, this type and this many bytes. The
 * length and type are part of the signature, so the URL cannot be used to store anything else.
 */
export function signedUploadUrl(key: string, contentType: string, size: number): Promise<string> {
  const { client, bucket } = required();
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: size }), {
    expiresIn: UPLOAD_URL_SECONDS,
    signableHeaders: new Set(['content-type', 'content-length']),
  });
}

export async function startMultipart(key: string, contentType: string): Promise<string> {
  const { client, bucket } = required();
  const started = await client.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType }));
  if (!started.UploadId) throw new Error('The bucket did not start the upload');
  return started.UploadId;
}

export function signedPartUrl(key: string, uploadId: string, partNumber: number): Promise<string> {
  const { client, bucket } = required();
  return getSignedUrl(client, new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }), {
    expiresIn: UPLOAD_URL_SECONDS,
  });
}

/**
 * Put the parts together. The part list is read from the bucket, not taken from the browser: it
 * is the bucket that knows what arrived, and reading it there means the bucket's CORS rule need
 * not expose ETag headers to the page.
 */
export async function finishMultipart(key: string, uploadId: string): Promise<void> {
  const { client, bucket } = required();
  const parts: CompletedPart[] = [];
  let marker: string | undefined;
  do {
    const page = await client.send(new ListPartsCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumberMarker: marker }));
    for (const part of page.Parts ?? []) parts.push({ PartNumber: part.PartNumber, ETag: part.ETag });
    marker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
  } while (marker);
  if (parts.length === 0) throw new Error('No parts were uploaded');
  await client.send(
    new CompleteMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId, MultipartUpload: { Parts: parts } })
  );
}

/** The stored object's size, or null when nothing is there. */
export async function storedSize(key: string): Promise<number | null> {
  const { client, bucket } = required();
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return head.ContentLength ?? 0;
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
}

export async function remove(key: string): Promise<void> {
  const { client, bucket } = required();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** A link that shows the object to whoever holds it, for seven days. */
export function signedViewUrl(key: string): Promise<string> {
  const { client, bucket } = required();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: VIEW_URL_SECONDS });
}

export async function writeRecord(id: string, record: unknown): Promise<void> {
  const { client, bucket } = required();
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: recordKey(id), ContentType: 'application/json', Body: JSON.stringify(record, null, 2) })
  );
}

export async function readRecord<T>(id: string): Promise<T | null> {
  const { client, bucket } = required();
  try {
    const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: recordKey(id) }));
    const text = await got.Body?.transformToString();
    return text ? (JSON.parse(text) as T) : null;
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
}
