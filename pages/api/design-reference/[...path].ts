import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

/**
 * Serves the captured design references in `design-references/` for local work.
 *
 * These are verbatim snapshots of third-party sites, kept so a layout can be
 * pulled apart and rebuilt. They carry someone else's branding and copy, so
 * they must never be served from our domain — publishing one would present
 * another company's site as ours.
 *
 * Two things keep that from happening:
 *
 *   1. This route 404s unless NODE_ENV is 'development'. The box runs
 *      production, so it is dark there.
 *   2. The files live outside `public/`, so the static export never emits them
 *      and GitHub Pages has nothing to serve.
 *
 * Remove the gate only once a reference has been replaced by our own content.
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
  if (process.env.NODE_ENV !== 'development') {
    return void res.status(404).json({ error: 'Not found' });
  }

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
