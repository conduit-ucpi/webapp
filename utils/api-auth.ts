import { NextApiRequest } from 'next';

/**
 * Extracts authentication token from either cookie or Authorization header
 * Supports both cookie-based auth (regular web) and bearer token auth (Farcaster mini-apps)
 */
export function extractAuthToken(req: NextApiRequest): string | null {
  console.log('🔧 extractAuthToken: Starting token extraction');
  
  // First try Authorization header (for Farcaster mini-apps)
  const authHeader = req.headers.authorization;
  console.log('🔧 extractAuthToken: Authorization header:', authHeader ? 'Present' : 'Missing');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('🔧 extractAuthToken: Found Bearer token, length:', token.length);
    return token;
  }

  // Fallback to AUTH-TOKEN cookie (for regular web apps)
  const cookies = req.headers.cookie || '';
  console.log('🔧 extractAuthToken: Checking cookies:', cookies ? 'Present' : 'Missing');
  const authTokenMatch = cookies.match(/AUTH-TOKEN=([^;]+)/);
  
  if (authTokenMatch) {
    console.log('🔧 extractAuthToken: Found AUTH-TOKEN cookie');
    return authTokenMatch[1];
  }
  
  console.log('🔧 extractAuthToken: No token found in either header or cookie');
  return null;
}

/**
 * Standard auth validation for API routes
 * Returns the token if found, throws 401 error response if not
 */
export function requireAuth(req: NextApiRequest): string {
  console.log('🔧 requireAuth: Starting auth validation');
  const authToken = extractAuthToken(req);
  
  if (!authToken) {
    console.log('🔧 requireAuth: No token found, throwing error');
    throw new Error('Authentication required');
  }
  
  console.log('🔧 requireAuth: Token found successfully');
  return authToken;
}