import { NextApiRequest, NextApiResponse } from 'next';
import { ADDRESS, HEX, forwardToChainAsUser, signedMessageOf } from '@/lib/server/chainAsUser';
import { isPathSegment } from '@/lib/server/serviceProxy';

/**
 * POST /api/chain/raise-dispute — the buyer raises a dispute, and chainservice sends it.
 *
 * Two ways in, and exactly one of them:
 *
 *   signedCall         {nonce, deadline, signature}: the buyer's signed MESSAGE (type
 *                      RaiseDispute). chainservice delivers it and pays the gas; no ETH reaches
 *                      the buyer. Only on a contract that takes signed actions
 *                      (/api/chain/contract/<address>/signed-calls).
 *   signedTransaction  the buyer's own signed transaction, relayed after a gas top-up. The
 *                      older route, for wallets that can sign without sending.
 *
 * ⚠️ chainservice RECORDS THE DISPUTE, NOT THE CALLER. Pass `databaseId` with `reason` and
 *    `refundPercent`, and it writes the dispute to contractservice once it is on chain: the
 *    service that raised it is the one that knows it happened. Do not also record it through
 *    /api/contracts/<id>/dispute, or it is recorded twice.
 *
 *    The answer carries `recorded`: true when written; FALSE when the dispute is on chain but
 *    the record could not be written (`success` is still true: record it again, never raise it
 *    again); null when no `databaseId` was given.
 *
 * Only these fields are forwarded; the body is rebuilt, never passed through.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body ?? {};
  if (typeof body.contractAddress !== 'string' || !ADDRESS.test(body.contractAddress)) {
    return res.status(400).json({ error: 'contractAddress must be an address' });
  }
  if (typeof body.userWalletAddress !== 'string' || !ADDRESS.test(body.userWalletAddress)) {
    return res.status(400).json({ error: 'userWalletAddress must be an address' });
  }

  const hasMessage = body.signedCall !== undefined && body.signedCall !== null;
  const hasTransaction = typeof body.signedTransaction === 'string' && body.signedTransaction.trim() !== '';
  if (hasMessage === hasTransaction) {
    return res.status(400).json({ error: 'Send either signedCall or signedTransaction, not both and not neither' });
  }

  const forwarded: Record<string, unknown> = {
    contractAddress: body.contractAddress,
    userWalletAddress: body.userWalletAddress
  };
  if (hasMessage) {
    const signed = signedMessageOf(body.signedCall);
    if (!signed.ok) {
      return res.status(400).json({ error: signed.error });
    }
    forwarded.signedCall = signed.message;
  } else {
    if (!HEX.test(body.signedTransaction)) {
      return res.status(400).json({ error: 'signedTransaction must be hex' });
    }
    forwarded.signedTransaction = body.signedTransaction;
  }

  if (body.databaseId !== undefined && body.databaseId !== null) {
    if (!isPathSegment(body.databaseId)) {
      return res.status(400).json({ error: 'databaseId is not a contract id' });
    }
    forwarded.databaseId = body.databaseId;
  }
  if (body.reason !== undefined && body.reason !== null) {
    if (typeof body.reason !== 'string' || body.reason.length > 160) {
      return res.status(400).json({ error: 'reason must be 160 characters or less' });
    }
    forwarded.reason = body.reason;
  }
  if (body.refundPercent !== undefined && body.refundPercent !== null) {
    if (!Number.isInteger(body.refundPercent) || body.refundPercent < 0 || body.refundPercent > 100) {
      return res.status(400).json({ error: 'refundPercent must be a whole number from 0 to 100' });
    }
    forwarded.refundPercent = body.refundPercent;
  }

  await forwardToChainAsUser(req, res, {
    method: 'POST',
    path: '/api/chain/raise-dispute',
    body: forwarded,
    what: 'Raise dispute'
  });
}
