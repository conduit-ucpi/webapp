/**
 * Where "Report a problem" recordings go, read from the environment (see recordingStore.ts for
 * what each variable is). On its own, without the S3 client, so that /api/config can say whether
 * the feature is on without loading it.
 */
export interface RecordingsConfig {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string | undefined;
  region: string;
}

/** The configuration, or null when no bucket is configured. */
export function recordingsConfig(): RecordingsConfig | null {
  const bucket = process.env.RECORDINGS_S3_BUCKET;
  const accessKeyId = process.env.RECORDINGS_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.RECORDINGS_S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint: process.env.RECORDINGS_S3_ENDPOINT || undefined,
    region: process.env.RECORDINGS_S3_REGION || 'auto',
  };
}

export const recordingsConfigured = (): boolean => recordingsConfig() !== null;
