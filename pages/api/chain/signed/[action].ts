import { NextApiRequest, NextApiResponse } from 'next';
import { ADDRESS, forwardToChainAsUser, signedMessageOf } from '@/lib/server/chainAsUser';

/**
 * POST /api/chain/signed/<action> — deliver a party's SIGNED MESSAGE to their contract.
 *
 * One address per action, each taking that action's own named arguments, the same names the
 * wallet showed when the party signed:
 *
 *   submit-resolution-vote       refundToBuyerPercent
 *   nominate-arbiter             candidate
 *   evict-arbiter                (none)
 *   resign-arbiter               (none)
 *   change-recipient             newRecipient
 *   approve-recipient-transfer   operator, newRecipient
 *
 * plus, always: contractAddress, signer, nonce, deadline, signature.
 *
 * chainservice sends the transaction and pays the gas; the contract checks the signature and
 * acts for the signer. Nothing here decides whether the signer may do the thing.
 *
 * ⚠️ ONLY THE FIELDS AN ACTION TAKES ARE FORWARDED. The body is rebuilt, never passed through,
 *    so nothing a caller adds can reach chainservice.
 *
 * Raising a dispute is /api/chain/raise-dispute: it has a record to write afterwards.
 */
type Field = 'address' | 'percent';

const ACTIONS: Record<string, Record<string, Field>> = {
  'submit-resolution-vote': { refundToBuyerPercent: 'percent' },
  'nominate-arbiter': { candidate: 'address' },
  'evict-arbiter': {},
  'resign-arbiter': {},
  'change-recipient': { newRecipient: 'address' },
  'approve-recipient-transfer': { operator: 'address', newRecipient: 'address' }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.query;
  const fields = typeof action === 'string' && Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
  if (!fields) {
    return res.status(404).json({ error: 'Unknown action' });
  }

  const body = req.body ?? {};
  if (typeof body.contractAddress !== 'string' || !ADDRESS.test(body.contractAddress)) {
    return res.status(400).json({ error: 'contractAddress must be an address' });
  }
  if (typeof body.signer !== 'string' || !ADDRESS.test(body.signer)) {
    return res.status(400).json({ error: 'signer must be an address' });
  }
  const signed = signedMessageOf(body);
  if (!signed.ok) {
    return res.status(400).json({ error: signed.error });
  }

  const forwarded: Record<string, unknown> = {
    contractAddress: body.contractAddress,
    signer: body.signer,
    ...signed.message
  };
  for (const [name, kind] of Object.entries(fields)) {
    const value = body[name];
    if (kind === 'address') {
      if (typeof value !== 'string' || !ADDRESS.test(value)) {
        return res.status(400).json({ error: `${name} must be an address` });
      }
    } else if (!Number.isInteger(value) || value < 0 || value > 100) {
      return res.status(400).json({ error: `${name} must be a whole number from 0 to 100` });
    }
    forwarded[name] = value;
  }

  await forwardToChainAsUser(req, res, {
    method: 'POST',
    path: `/api/chain/signed/${action}`,
    body: forwarded,
    what: `Signed ${action}`
  });
}
