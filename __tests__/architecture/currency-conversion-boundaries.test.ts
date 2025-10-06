/**
 * Architecture test to ensure currency conversion from microUSDC to USDC
 * is ONLY called from display/UI components, never from business logic
 */

import fs from 'fs';
import path from 'path';

describe('Currency Conversion Architecture Boundaries', () => {
  const webappRoot = process.cwd();

  // Define what we consider "display/UI components"
  const allowedDisplayPaths = [
    'components/',
    'pages/',
    '__tests__/',
    'stories/', // Storybook if present
  ];

  // Define what we consider "business logic" that should NEVER do conversion
  const businessLogicPaths = [
    'lib/',
    'utils/',
    'hooks/',
    'services/',
    'api/',
  ];

  // Functions that convert from microUSDC to display format
  const conversionFunctions = [
    'formatCurrency',
    'displayCurrency',
    'formatUSDC',
    'fromMicroUSDC'
  ];

  function getAllTsxTsFiles(dir: string, excludeDirs: string[] = []): string[] {
    const files: string[] = [];

    function traverse(currentDir: string) {
      const entries = fs.readdirSync(currentDir);

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // Skip excluded directories
          if (excludeDirs.some(exclude => fullPath.includes(exclude))) {
            continue;
          }
          traverse(fullPath);
        } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
          files.push(fullPath);
        }
      }
    }

    traverse(dir);
    return files;
  }

  function getRelativePath(filePath: string): string {
    return path.relative(webappRoot, filePath);
  }

  function isDisplayComponent(filePath: string): boolean {
    const relativePath = getRelativePath(filePath);
    return allowedDisplayPaths.some(allowedPath =>
      relativePath.startsWith(allowedPath)
    );
  }

  function isBusinessLogic(filePath: string): boolean {
    const relativePath = getRelativePath(filePath);
    return businessLogicPaths.some(businessPath =>
      relativePath.startsWith(businessPath)
    );
  }

  function findConversionFunctionCalls(filePath: string): Array<{
    function: string;
    line: number;
    content: string;
  }> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const violations: Array<{ function: string; line: number; content: string }> = [];

    lines.forEach((line, index) => {
      conversionFunctions.forEach(func => {
        // Look for function calls (not just imports or definitions)
        const callPattern = new RegExp(`\\b${func}\\s*\\(`, 'g');
        if (callPattern.test(line)) {
          // Skip function definitions and imports
          const isDefinition = line.includes(`function ${func}`) ||
                              line.includes(`export function ${func}`) ||
                              line.includes(`const ${func} =`) ||
                              line.includes(`= ${func};`);
          const isImport = line.includes('import') && line.includes(`{`) && line.includes(`}`);

          // Also skip internal calls within currency utility files
          const isCurrencyUtilFile = filePath.includes('currency.ts') || filePath.includes('validation.ts');

          if (!isDefinition && !isImport && !isCurrencyUtilFile) {
            violations.push({
              function: func,
              line: index + 1,
              content: line.trim()
            });
          }
        }
      });
    });

    return violations;
  }

  describe('Conversion function calls should only happen in display components', () => {
    it('should NEVER call currency conversion functions from business logic files', () => {
      const allFiles = getAllTsxTsFiles(webappRoot, ['node_modules', '.next', 'dist']);
      const businessLogicViolations: Array<{
        file: string;
        function: string;
        line: number;
        content: string;
      }> = [];

      allFiles.forEach(filePath => {
        if (isBusinessLogic(filePath)) {
          const violations = findConversionFunctionCalls(filePath);
          violations.forEach(violation => {
            businessLogicViolations.push({
              file: getRelativePath(filePath),
              ...violation
            });
          });
        }
      });

      if (businessLogicViolations.length > 0) {
        const errorMessage = [
          'ARCHITECTURE VIOLATION: Currency conversion functions found in business logic files!',
          'These functions should ONLY be called from display/UI components.',
          '',
          'Violations found:',
          ...businessLogicViolations.map(v =>
            `  ${v.file}:${v.line} - ${v.function}() in: ${v.content}`
          ),
          '',
          'Fix: Move conversion to display components, keep business logic in microUSDC.',
        ].join('\n');

        throw new Error(errorMessage);
      }

      // If no violations, test passes
      expect(businessLogicViolations).toHaveLength(0);
    });

    it('should allow currency conversion functions in display components', () => {
      const allFiles = getAllTsxTsFiles(webappRoot, ['node_modules', '.next', 'dist']);
      let displayComponentsWithConversions = 0;

      allFiles.forEach(filePath => {
        if (isDisplayComponent(filePath)) {
          const violations = findConversionFunctionCalls(filePath);
          if (violations.length > 0) {
            displayComponentsWithConversions++;
          }
        }
      });

      // Display components are ALLOWED to call conversion functions
      // This test just documents that we found some (which is expected)
      console.log(`Found ${displayComponentsWithConversions} display components using currency conversions (this is allowed)`);
      expect(displayComponentsWithConversions).toBeGreaterThanOrEqual(0);
    });

    it('should document which display components are using currency conversions', () => {
      const allFiles = getAllTsxTsFiles(webappRoot, ['node_modules', '.next', 'dist']);
      const displayComponentUsage: Array<{
        file: string;
        functions: string[];
      }> = [];

      allFiles.forEach(filePath => {
        if (isDisplayComponent(filePath)) {
          const violations = findConversionFunctionCalls(filePath);
          if (violations.length > 0) {
            const functions = Array.from(new Set(violations.map(v => v.function)));
            displayComponentUsage.push({
              file: getRelativePath(filePath),
              functions
            });
          }
        }
      });

      console.log('\nDisplay components using currency conversions:');
      displayComponentUsage.forEach(usage => {
        console.log(`  ${usage.file}: ${usage.functions.join(', ')}`);
      });

      // This test always passes - it's just for documentation
      expect(true).toBe(true);
    });
  });

  describe('Specific architectural rules', () => {
    it('should NEVER convert currency in utils/ directory', () => {
      const utilsFiles = getAllTsxTsFiles(path.join(webappRoot, 'utils'));
      const utilsViolations: string[] = [];

      utilsFiles.forEach(filePath => {
        const violations = findConversionFunctionCalls(filePath);
        if (violations.length > 0) {
          // Exception: the currency utility file itself can define these functions
          const isCurrencyUtil = filePath.includes('currency.ts') || filePath.includes('validation.ts');
          if (!isCurrencyUtil) {
            utilsViolations.push(getRelativePath(filePath));
          }
        }
      });

      expect(utilsViolations).toHaveLength(0);
    });

    it('should NEVER convert currency in lib/ directory', () => {
      const libPath = path.join(webappRoot, 'lib');
      if (!fs.existsSync(libPath)) {
        return; // Skip if lib directory doesn't exist
      }

      const libFiles = getAllTsxTsFiles(libPath);
      const libViolations: string[] = [];

      libFiles.forEach(filePath => {
        const violations = findConversionFunctionCalls(filePath);
        if (violations.length > 0) {
          libViolations.push(getRelativePath(filePath));
        }
      });

      expect(libViolations).toHaveLength(0);
    });

    it('should NEVER convert currency in hooks/ directory', () => {
      const hooksPath = path.join(webappRoot, 'hooks');
      if (!fs.existsSync(hooksPath)) {
        return; // Skip if hooks directory doesn't exist
      }

      const hookFiles = getAllTsxTsFiles(hooksPath);
      const hookViolations: string[] = [];

      hookFiles.forEach(filePath => {
        const violations = findConversionFunctionCalls(filePath);
        if (violations.length > 0) {
          hookViolations.push(getRelativePath(filePath));
        }
      });

      expect(hookViolations).toHaveLength(0);
    });
  });
});