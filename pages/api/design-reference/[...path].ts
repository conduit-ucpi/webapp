import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

/**
 * Serves the captured snapshots in `design-references/`.
 *
 * Used for the COBRO pitch: `/cobro-demo` rewrites to
 * `/api/design-reference/cobro/index.html`, which renders the captured page
 * without any of the app's chrome.
 *
 * Runs in every environment. Note the files live outside `public/`, so the
 * static export still does not emit them — this route is what serves them, and
 * it exists only on the server build.
 */

const ROOT = path.join(process.cwd(), 'design-references');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const segments = req.query.path;
  const parts = Array.isArray(segments) ? segments : [segments].filter(Boolean) as string[];
  if (!parts.length) return void res.status(404).end();

  // Resolve, then confirm the result is still inside ROOT. Checking the joined
  // string for '..' is not enough — encoded traversal and symlinks both slip past.
  const target = path.resolve(ROOT, ...parts);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    return void res.status(403).json({ error: 'Forbidden' });
  }

  let file = target;
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  } catch {
    return void res.status(404).end();
  }

  if (!fs.existsSync(file)) return void res.status(404).end();

  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  return void res.status(200).send(fs.readFileSync(file));
}
