import { NextApiRequest, NextApiResponse } from 'next';
import { fetchIdentity } from '@/lib/server/coinbaseCdp';
import { extractAuthToken } from '@/utils/api-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ⚠️ SIGNED IN, AND CHECKED WITH USERSERVICE. Each call spends the Neynar key, and until
  //    19 Nov 2026 anyone on the internet could make one (someone did, with injection strings).
  //    A token being present is not enough: it is whatever the caller sent.
  const authToken = extractAuthToken(req);
  if (!authToken || !(await fetchIdentity(req, authToken))) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { fid } = req.query;
  
  if (typeof fid !== 'string' || !/^\d{1,12}$/.test(fid)) {
    return res.status(400).json({ error: 'FID is required' });
  }

  const neynarApiKey = process.env.NEYNAR_API_KEY;
  const neynarApiUrl = process.env.NEYNAR_API_URL;
  
  if (!neynarApiKey || !neynarApiUrl) {
    return res.status(500).json({ error: 'Neynar API configuration missing' });
  }

  try {
    const response = await fetch(`${neynarApiUrl}/user/bulk?fids=${fid}`, {
      headers: {
        'accept': 'application/json',
        'x-api-key': neynarApiKey
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch user' });
    }

    const data = await response.json();
    const neynarUser = data.users?.[0];

    if (!neynarUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = {
      fid: neynarUser.fid,
      username: neynarUser.username,
      displayName: neynarUser.display_name,
      pfpUrl: neynarUser.pfp_url,
      followerCount: neynarUser.follower_count,
      verified: neynarUser.verified_addresses?.eth_addresses?.length > 0
    };

    res.status(200).json({ user });
  } catch (error) {
    console.error('Error fetching Farcaster user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}