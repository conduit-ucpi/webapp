import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { logs, sessionId } = req.body;

    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({ error: 'Invalid logs data' });
    }

    // Log each entry to the server console with timestamp and session
    logs.forEach((log: any) => {
      const timestamp = new Date(log.timestamp).toISOString();
      const logMessage = `[MOBILE-DEBUG:${sessionId}] [${timestamp}] [${log.level.toUpperCase()}] [${log.component}] ${log.message}`;

      // Log to server console based on level
      switch (log.level) {
        case 'error':
          console.error(logMessage, log.data ? JSON.stringify(log.data, null, 2) : '');
          break;
        case 'warn':
          console.warn(logMessage, log.data ? JSON.stringify(log.data, null, 2) : '');
          break;
        case 'info':
          console.info(logMessage, log.data ? JSON.stringify(log.data, null, 2) : '');
          break;
        default:
          console.log(logMessage, log.data ? JSON.stringify(log.data, null, 2) : '');
          break;
      }

      // If there's additional data, log it separately for better readability
      if (log.data) {
        console.log(`[MOBILE-DEBUG:${sessionId}] [${timestamp}] [DATA]`, JSON.stringify(log.data, null, 2));
      }

      // Log URL and user agent for context
      if (log.url || log.userAgent) {
        console.log(`[MOBILE-DEBUG:${sessionId}] [${timestamp}] [CONTEXT] URL: ${log.url}, UserAgent: ${log.userAgent}`);
      }
    });

    // Log batch summary
    console.log(`[MOBILE-DEBUG:${sessionId}] Received ${logs.length} log entries`);

    res.status(200).json({ success: true, received: logs.length });
  } catch (error) {
    console.error('[MOBILE-DEBUG] Error processing mobile logs:', error);
    res.status(500).json({ error: 'Failed to process logs' });
  }
}