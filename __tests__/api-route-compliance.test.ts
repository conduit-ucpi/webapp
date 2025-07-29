/**
 * Test to ensure frontend components only call Next.js API routes, not backend services directly
 */

import fs from 'fs';
import path from 'path';

// Backend service URLs that should never be called directly from frontend
const BACKEND_SERVICE_PATTERNS = [
  /userService:\d+/,
  /chainService:\d+/,
  /process\.env\.USER_SERVICE_URL/,
  /process\.env\.CHAIN_SERVICE_URL/,
  /localhost:897[78]/,
  /api\.conduit-ucpi\.com\/userService/,
  /api\.conduit-ucpi\.com\/chainService/,
];

// These paths should only call Next.js API routes (starting with /api/)
const FRONTEND_PATHS = [
  'components/',
  'pages/',
  'hooks/',
  'lib/',
  'utils/',
];

// These are server-side files that are allowed to call backend services directly
const SERVER_SIDE_EXCEPTIONS = [
  'pages/api/',
  'lib/server',
  'middleware.ts',
];

function getAllFiles(dir: string, extension: string): string[] {
  const files: string[] = [];
  
  function walkDir(currentPath: string) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        walkDir(fullPath);
      } else if (stat.isFile() && item.endsWith(extension)) {
        files.push(fullPath);
      }
    }
  }
  
  walkDir(dir);
  return files;
}

function isServerSideFile(filePath: string): boolean {
  return SERVER_SIDE_EXCEPTIONS.some(exception => 
    filePath.includes(exception)
  );
}

function isFrontendFile(filePath: string): boolean {
  return FRONTEND_PATHS.some(frontendPath => 
    filePath.includes(frontendPath)
  ) && !isServerSideFile(filePath);
}

describe('API Route Compliance', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const tsFiles = getAllFiles(projectRoot, '.ts');
  const tsxFiles = getAllFiles(projectRoot, '.tsx');
  const allFiles = [...tsFiles, ...tsxFiles];

  test('Frontend components should not call backend services directly', () => {
    const violations: Array<{file: string, line: number, content: string}> = [];

    for (const filePath of allFiles) {
      if (!isFrontendFile(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Skip comments
        if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
        
        for (const pattern of BACKEND_SERVICE_PATTERNS) {
          if (pattern.test(line)) {
            violations.push({
              file: path.relative(projectRoot, filePath),
              line: index + 1,
              content: line.trim()
            });
          }
        }
      });
    }

    if (violations.length > 0) {
      const errorMessage = violations
        .map(v => `${v.file}:${v.line} - ${v.content}`)
        .join('\n');
      
      fail(`Frontend files should not call backend services directly. Found violations:\n${errorMessage}\n\nUse Next.js API routes instead (e.g., /api/auth/identity instead of USER_SERVICE_URL/api/user/identity)`);
    }
  });

  test('Frontend components should only use relative API paths', () => {
    const violations: Array<{file: string, line: number, content: string}> = [];

    for (const filePath of allFiles) {
      if (!isFrontendFile(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Look for fetch calls that don't use relative paths or router.basePath
        if (line.includes('fetch(') && !line.includes('//')) {
          // Check if it's calling an absolute URL to backend services
          const fetchMatch = line.match(/fetch\(\s*['"`]([^'"`]+)['"`]/);
          if (fetchMatch) {
            const url = fetchMatch[1];
            // Flag URLs that look like direct backend calls
            if (url.includes('userService') || url.includes('chainService') || url.match(/localhost:\d+/)) {
              violations.push({
                file: path.relative(projectRoot, filePath),
                line: index + 1,
                content: line.trim()
              });
            }
          }
        }
      });
    }

    if (violations.length > 0) {
      const errorMessage = violations
        .map(v => `${v.file}:${v.line} - ${v.content}`)
        .join('\n');
      
      fail(`Frontend files should use relative API paths or router.basePath. Found violations:\n${errorMessage}`);
    }
  });
});