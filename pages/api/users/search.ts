import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q } = req.query;
  
  if (!q || typeof q !== 'string' || q.trim().length < 1) {
    return res.status(400).json({ error: 'Query parameter "q" is required and must be at least 1 character' });
  }

  const apiKey = process.env.NEYNAR_API_KEY;
  const neynarApiUrl = process.env.NEYNAR_API_URL;
  
  if (!apiKey || !neynarApiUrl) {
    console.error('Neynar API configuration missing');
    return res.status(500).json({ error: 'User search service not configured' });
  }

  try {
    const url = `${neynarApiUrl}/user/search?q=${encodeURIComponent(q)}&limit=10`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-key': apiKey
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.error('Neynar API authentication failed');
        return res.status(500).json({ error: 'Invalid Neynar API key' });
      }
      if (response.status === 402) {
        console.error('Neynar API payment required');
        return res.status(500).json({ error: 'Neynar API key issue - check if key is valid or has exceeded its limits' });
      }
      if (response.status === 429) {
        console.error('Neynar API rate limit exceeded');
        return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
      }
      throw new Error(`Neynar API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform the response to our format
    const users = data.result?.users?.map((user: any) => ({
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      pfpUrl: user.pfp_url,
      followerCount: user.follower_count,
      verified: user.verified_addresses?.eth_addresses?.length > 0
    })) || [];

    return res.status(200).json({ users });
  } catch (error) {
    console.error('Error searching Farcaster users:', error);
    return res.status(500).json({ error: 'Failed to search users' });
  }
}