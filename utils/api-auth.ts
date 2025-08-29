import { NextApiRequest } from 'next';

/**
 * Extracts authentication token from either cookie or Authorization header
 * Supports both cookie-based auth (regular web) and bearer token auth (Farcaster mini-apps)
 */
export function extractAuthToken(req: NextApiRequest): string | null {
  // First try Authorization header (for Farcaster mini-apps)
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    return token;
  }

  // Fallback to AUTH-TOKEN cookie (for regular web apps)
  const cookies = req.headers.cookie || '';
  const authTokenMatch = cookies.match(/AUTH-TOKEN=([^;]+)/);
  
  if (authTokenMatch) {
    return authTokenMatch[1];
  }
  
  return null;
}

/**
 * Standard auth validation for API routes
 * Returns the token if found, throws 401 error response if not
 */
export function requireAuth(req: NextApiRequest): string {
  const authToken = extractAuthToken(req);
  
  if (!authToken) {
    throw new Error('Authentication required');
  }
  
  return authToken;
}