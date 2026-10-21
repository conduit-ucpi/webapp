import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard } from '@/lib/server/serviceProxy';
import { ScreenFailure, screenBeforeSweep } from '@/lib/server/sweepFeeScreening';

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

/**
 * Sanctions-check everyone connected to one escrow before its fee is swept. Reports only; the
 * sweep is a separate call. See lib/server/sweepFeeScreening.ts for who is screened and how.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  const { contractAddress, target1, target2, trace } = req.body ?? {};
  const escrow = typeof contractAddress === 'string' ? contractAddress.trim() : '';
  const targets = [target1, target2]
    .filter((t): t is string => typeof t === 'string' && t.trim() !== '')
    .map((t) => t.trim());
  if (!ADDRESS.test(escrow) || targets.some((t) => !ADDRESS.test(t))) {
    return void res.status(400).json({ clean: false, error: 'Escrow and target addresses must be 0x followed by 40 hex characters' });
  }

  try {
    res.status(200).json(await screenBeforeSweep(req, escrow, targets, trace === true));
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return void res.status(401).json({ clean: false, error: 'Authentication required' });
    }
    if (error instanceof ScreenFailure) {
      return void res.status(error.status).json({ clean: false, error: error.message });
    }
    console.error(`Sanctions check before sweeping ${escrow} failed:`, error);
    res.status(500).json({ clean: false, error: 'Internal server error' });
  }
}
