/**
 * Architecture Test: Wallet Provider Abstraction
 *
 * This test ensures that all components are properly using the wallet abstraction
 * and not making direct calls to Web3Auth or other wallet providers.
 */

import fs from 'fs';
import path from 'path';

describe('Wallet Provider Abstraction', () => {
  let componentFiles: string[] = [];
  let pageFiles: string[] = [];
  let hookFiles: string[] = [];

  // Helper function to recursively find files
  const findFiles = (dir: string, extensions: string[]): string[] => {
    const files: string[] = [];

    const scanDir = (currentDir: string, relativePath = '') => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relativeFilePath = path.join(relativePath, entry.name);

        if (entry.isDirectory()) {
          scanDir(fullPath, relativeFilePath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(relativeFilePath);
          }
        }
      }
    };

    if (fs.existsSync(dir)) {
      scanDir(dir);
    }

    return files;
  };

  beforeAll(() => {
    const baseDir = path.join(__dirname, '../../');

    // Get all TypeScript/JSX files that might use wallet functionality
    componentFiles = findFiles(path.join(baseDir, 'components'), ['.ts', '.tsx']);
    pageFiles = findFiles(path.join(baseDir, 'pages'), ['.ts', '.tsx']);
    hookFiles = findFiles(path.join(baseDir, 'hooks'), ['.ts', '.tsx']);
  });

  describe('No Direct Web3Auth Access', () => {
    const prohibitedPatterns = [
      {
        pattern: /\(window as any\)\.web3auth(?!Provider)/,
        description: 'Direct access to window.web3auth'
      },
      {
        pattern: /\(window as any\)\.web3authProvider/,
        description: 'Direct access to window.web3authProvider'
      },
      {
        pattern: /window\.web3auth(?!Provider)/,
        description: 'Direct access to window.web3auth without casting'
      },
      {
        pattern: /window\.web3authProvider/,
        description: 'Direct access to window.web3authProvider without casting'
      }
    ];

    const allowedFiles = [
      // These files are allowed to access Web3Auth directly as they implement the abstraction
      'auth/Web3AuthProviderWrapper.tsx',
      'auth/Web3AuthContextProvider.tsx',
      'auth/AuthProvider.tsx' // May need to clean up Web3Auth state
    ];

    const allFiles = [
      ...componentFiles.map(f => ({ type: 'component', file: f })),
      ...pageFiles.map(f => ({ type: 'page', file: f })),
      ...hookFiles.map(f => ({ type: 'hook', file: f }))
    ];

    if (allFiles.length === 0) {
      test('No files found - check file discovery', () => {
        expect(componentFiles.length + pageFiles.length + hookFiles.length).toBeGreaterThan(0);
      });
      return;
    }

    test.each(allFiles)('$type file $file should not have direct Web3Auth access', ({ file }) => {
      // Skip allowed files
      if (allowedFiles.includes(file)) {
        return;
      }

      const fullPath = path.join(__dirname, '../../components', file);

      // Skip if file doesn't exist
      if (!fs.existsSync(fullPath)) {
        return;
      }

      const content = fs.readFileSync(fullPath, 'utf-8');

      // Check for prohibited patterns
      for (const { pattern, description } of prohibitedPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          const lines = content.split('\n');
          const matchingLines = lines
            .map((line, index) => ({ line: line.trim(), number: index + 1 }))
            .filter(({ line }) => pattern.test(line));

          throw new Error(
            `${file} contains ${description}:\n` +
            matchingLines.map(({ line, number }) => `  Line ${number}: ${line}`).join('\n') +
            '\n\nComponents should use useAuth() hook and walletProvider instead.'
          );
        }
      }
    });
  });

  describe('Proper Abstraction Usage', () => {
    // Files that should be using the auth abstraction (components that interact with Web3)
    const walletUsingComponents = [
      'contracts/CreateContract.tsx',
      'contracts/ContractActions.tsx',
      'contracts/ContractAcceptance.tsx',
      'contracts/CreateContractWizard.tsx'
    ];

    test.each(walletUsingComponents)('%s should use auth context for wallet operations', (file) => {
      const fullPath = path.join(__dirname, '../../components', file);

      if (!fs.existsSync(fullPath)) {
        return;
      }

      const content = fs.readFileSync(fullPath, 'utf-8');

      // Should import useAuth from auth context OR use a hook that encapsulates auth
      const hasDirectAuthImport = /import.*useAuth.*from.*@\/components\/auth/.test(content);
      const usesCustomHook = /use[A-Z]\w*/.test(content) && (
        /useCreateContract/.test(content) ||
        /useContractAcceptance/.test(content) ||
        /useContract\w*/.test(content)
      );

      if (!hasDirectAuthImport && !usesCustomHook) {
        throw new Error(`${file} should import useAuth from @/components/auth OR use a custom hook that encapsulates auth functionality`);
      }

      // Should use the auth context directly OR through a custom hook
      const usesAuthDirectly = /useAuth\(\)/.test(content);
      const usesAuthViaHook = usesCustomHook;

      if (!usesAuthDirectly && !usesAuthViaHook) {
        throw new Error(`${file} should call useAuth() OR use a custom hook that provides auth functionality`);
      }

      // Should not use deprecated useWeb3SDK hook
      const usesDeprecatedSDK = /useWeb3SDK\(\)/.test(content);

      if (usesDeprecatedSDK) {
        throw new Error(`${file} should not use deprecated useWeb3SDK hook - use useAuth() instead`);
      }
    });
  });

  describe('Web3Service Usage', () => {
    test('Web3Service should use unified provider architecture', () => {
      const web3ServicePath = path.join(__dirname, '../../lib/web3.ts');
      const content = fs.readFileSync(web3ServicePath, 'utf-8');

      // Should use ethers.BrowserProvider for unified provider pattern
      expect(content).toMatch(/ethers\.BrowserProvider/);

      // Should have single initialize method that accepts ethers provider
      expect(content).toMatch(/async initialize\(/);

      // Should not have legacy WalletProvider references
      expect(content).not.toMatch(/initializeProvider\(.*walletProvider.*:.*WalletProvider\)/);

      // Should not have separate initialization methods
      expect(content).not.toMatch(/initializeWithEthersProvider/);
      expect(content).not.toMatch(/initializeWithEIP1193/);
    });
  });

  describe('Import Patterns', () => {
    const componentFilesToCheck = [
      ...componentFiles.filter(f => f.includes('contracts/')), // Contract-related components
      ...pageFiles.filter(f => !f.includes('api/')) // Pages but not API routes
    ];

    if (componentFilesToCheck.length === 0) {
      test('No relevant files found for import pattern check', () => {
        expect(componentFiles.length + pageFiles.length).toBeGreaterThan(0);
      });
      return;
    }

    test.each(componentFilesToCheck)('%s should not import Web3Auth directly', (file) => {
      // Skip allowed files that need direct Web3Auth access
      const allowedFiles = [
        'auth/Web3AuthProviderWrapper.tsx',
        'auth/Web3AuthContextProvider.tsx',
        'auth/AuthProvider.tsx'
      ];

      if (allowedFiles.includes(file)) {
        return;
      }

      const fullPath = path.join(__dirname, '../../components', file);

      if (!fs.existsSync(fullPath)) {
        return;
      }

      const content = fs.readFileSync(fullPath, 'utf-8');

      // Should not import Web3Auth SDK directly
      expect(content).not.toMatch(/import.*from.*@web3auth/);

      // Should not import deprecated useWeb3SDK hook
      expect(content).not.toMatch(/import.*useWeb3SDK.*from.*@\/hooks\/useWeb3SDK/);

      // If interacting with wallet functionality, should use auth context
      if (content.includes('walletAddress') || content.includes('getEthersProvider')) {
        // Should import useAuth from auth context
        expect(content).toMatch(/import.*useAuth.*from.*@\/components\/auth/);
      }
    });
  });

  describe('Architecture Consistency', () => {
    test('Unified provider architecture should be in place', () => {
      const unifiedProviderPath = path.join(__dirname, '../../lib/auth/types/unified-provider.ts');

      if (!fs.existsSync(unifiedProviderPath)) {
        throw new Error('UnifiedProvider types file should exist');
      }

      const content = fs.readFileSync(unifiedProviderPath, 'utf-8');

      // Should have UnifiedProvider interface
      expect(content).toMatch(/interface UnifiedProvider/);

      // Should have core methods
      const requiredMethods = [
        'getProviderName\\(\\): string',
        'initialize\\(\\): Promise<void>',
        'connect\\(\\): Promise<ConnectionResult>',
        'disconnect\\(\\): Promise<void>',
        'getEthersProvider\\(\\): ethers\\.BrowserProvider \\| null',
        'getAddress\\(\\): Promise<string>',
        'signMessage\\(message: string\\): Promise<string>',
        'getAuthToken\\(\\): string \\| null',
        'getCapabilities\\(\\): ProviderCapabilities'
      ];

      requiredMethods.forEach(method => {
        expect(content).toMatch(new RegExp(method));
      });
    });

    test('Provider implementations should use UnifiedProvider interface', () => {
      const providersDir = path.join(__dirname, '../../lib/auth/providers');

      if (!fs.existsSync(providersDir)) {
        return;
      }

      const providerFiles = fs.readdirSync(providersDir)
        .filter(f => f.endsWith('Provider.ts'));

      providerFiles.forEach(file => {
        const content = fs.readFileSync(path.join(providersDir, file), 'utf-8');

        // Should implement UnifiedProvider interface
        expect(content).toMatch(/implements UnifiedProvider/);

        // Should import the unified provider types
        expect(content).toMatch(/UnifiedProvider[\s\S]*from[\s\S]*unified-provider/);
      });
    });
  });
});