declare module 'node-mocks-http' {
  import { IncomingMessage, ServerResponse } from 'http';
  import { NextApiRequest, NextApiResponse } from 'next';

  interface MockRequest extends NextApiRequest {
    body?: any;
    query?: any;
    headers?: any;
    method?: string;
  }

  interface MockResponse extends NextApiResponse {
    _getStatusCode(): number;
    _getData(): string;
    _getHeaders(): Record<string, any>;
  }

  interface MockOptions {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: any;
    query?: Record<string, string>;
  }

  export function createMocks(options?: MockOptions): {
    req: MockRequest;
    res: MockResponse;
  };
}