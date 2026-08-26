/**
 * Release flags. Each is read from a plain (non-NEXT_PUBLIC_) environment
 * variable so it stays a RUNTIME switch: the Docker image is built once and the
 * flag is flipped by redeploying with a different env value, no rebuild.
 *
 * Because they are not NEXT_PUBLIC_, these reads only work server-side. The
 * client learns a flag's value from /api/config (see `projectsLive` there),
 * consumed via useConfig(). Never import this module into a client component —
 * process.env.PROJECTS_LIVE is undefined in the browser bundle, so it would
 * silently read as false.
 */
import type { GetServerSideProps } from 'next';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Projects (fan-out / completion escrow). Off unless PROJECTS_LIVE is exactly
 * 'true' — anything else, including unset, keeps the feature dark.
 */
export function isProjectsLive(): boolean {
  return process.env.PROJECTS_LIVE === 'true';
}

/**
 * Page gate: a /projects/* page that 404s when the flag is off, exactly as if
 * the route did not exist. Server-side so there is no flash of the real page.
 */
export const projectsPageGate: GetServerSideProps = async () => {
  if (!isProjectsLive()) return { notFound: true };
  return { props: {} };
};

/**
 * API gate: returns true when the request was already answered with a 404
 * because the flag is off. Call at the top of every /api/projects/* handler.
 */
export function blockedByProjectsFlag(_req: NextApiRequest, res: NextApiResponse): boolean {
  if (isProjectsLive()) return false;
  res.status(404).json({ error: 'Not found' });
  return true;
}
