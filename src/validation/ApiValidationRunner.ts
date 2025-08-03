import { ApiValidator } from './ApiValidator';
import { ValidationResult, ApiValidationConfig } from './types';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

/**
 * Main entry point for API validation tasks.
 * TypeScript equivalent of the chainservice ApiValidationRunner.
 */
export class ApiValidationRunner {
  private config: ApiValidationConfig;

  constructor() {
    this.config = {
      enabled: process.env.API_VALIDATION_ENABLED !== 'false',
      failOnMismatch: process.env.API_VALIDATION_FAIL_ON_MISMATCH !== 'false',
      timeout: parseInt(process.env.API_VALIDATION_TIMEOUT || '30000'),
      environment: (process.env.API_VALIDATION_ENVIRONMENT as any) || 'development'
    };
  }

  async run(args: string[] = []): Promise<boolean> {
    try {
      if (!this.config.enabled) {
        console.log('API validation is disabled');
        return false;
      }

      const validator = new ApiValidator(this.config.timeout);
      let hasFailures: boolean;

      if (args.length > 0) {
        // Validate specific service
        const serviceName = args[0];
        console.log(`Validating API compatibility for service: ${serviceName}`);
        hasFailures = await this.validateSpecificService(validator, serviceName);
      } else {
        // Validate all services
        console.log('Validating API compatibility for all dependent services');
        hasFailures = await this.validateAllServices(validator);
      }

      if (hasFailures) {
        console.error('API validation completed with failures');
        if (this.config.failOnMismatch) {
          console.error('Failing build due to API validation failures');
          process.exit(1);
        }
      } else {
        console.log('API validation completed successfully');
      }

      return hasFailures;

    } catch (error) {
      console.error('API validation failed with error', error);
      process.exit(1);
    }
  }

  private async validateSpecificService(validator: ApiValidator, serviceName: string): Promise<boolean> {
    switch (serviceName.toLowerCase()) {
      case 'user-service':
        const userServiceUrl = process.env.USER_SERVICE_URL;
        if (!userServiceUrl) {
          console.error('USER_SERVICE_URL not configured in .env.local');
          return true;
        }
        const userResult = await validator.validateUserService(userServiceUrl);
        this.logValidationResult('User Service', userResult);
        return userResult.errors.length > 0;

      case 'chain-service':
        const chainServiceUrl = process.env.CHAIN_SERVICE_URL;
        if (!chainServiceUrl) {
          console.error('CHAIN_SERVICE_URL not configured in .env.local');
          return true;
        }
        const chainResult = await validator.validateChainService(chainServiceUrl);
        this.logValidationResult('Chain Service', chainResult);
        return chainResult.errors.length > 0;

      case 'contract-service':
        const contractServiceUrl = process.env.CONTRACT_SERVICE_URL;
        if (!contractServiceUrl) {
          console.error('CONTRACT_SERVICE_URL not configured in .env.local');
          return true;
        }
        const contractResult = await validator.validateContractService(contractServiceUrl);
        this.logValidationResult('Contract Service', contractResult);
        return contractResult.errors.length > 0;

      default:
        console.error(`Unknown service: ${serviceName}`);
        return true;
    }
  }

  private async validateAllServices(validator: ApiValidator): Promise<boolean> {
    const results: boolean[] = [];

    console.log();
    console.log('='.repeat(80));
    console.log('           API VALIDATION RESULTS');
    console.log('='.repeat(80));

    // Validate User Service
    const userServiceUrl = process.env.USER_SERVICE_URL;
    if (userServiceUrl) {
      console.log();
      console.log('📡 USER SERVICE VALIDATION');
      console.log(`   URL: ${userServiceUrl}`);
      console.log('   ' + '-'.repeat(60));
      const result = await validator.validateUserService(userServiceUrl);
      this.logValidationResult('User Service', result);
      results.push(result.errors.length > 0);
    } else {
      console.log();
      console.log('⚠️  USER SERVICE VALIDATION SKIPPED');
      console.log('   Reason: USER_SERVICE_URL not provided');
    }

    // Validate Chain Service
    const chainServiceUrl = process.env.CHAIN_SERVICE_URL;
    if (chainServiceUrl) {
      console.log();
      console.log('📡 CHAIN SERVICE VALIDATION');
      console.log(`   URL: ${chainServiceUrl}`);
      console.log('   ' + '-'.repeat(60));
      const result = await validator.validateChainService(chainServiceUrl);
      this.logValidationResult('Chain Service', result);
      results.push(result.errors.length > 0);
    } else {
      console.log();
      console.log('⚠️  CHAIN SERVICE VALIDATION SKIPPED');
      console.log('   Reason: CHAIN_SERVICE_URL not provided');
    }

    // Validate Contract Service
    const contractServiceUrl = process.env.CONTRACT_SERVICE_URL;
    if (contractServiceUrl) {
      console.log();
      console.log('📡 CONTRACT SERVICE VALIDATION');
      console.log(`   URL: ${contractServiceUrl}`);
      console.log('   ' + '-'.repeat(60));
      const result = await validator.validateContractService(contractServiceUrl);
      this.logValidationResult('Contract Service', result);
      results.push(result.errors.length > 0);
    } else {
      console.log();
      console.log('⚠️  CONTRACT SERVICE VALIDATION SKIPPED');
      console.log('   Reason: CONTRACT_SERVICE_URL not provided');
    }

    console.log();
    console.log('='.repeat(80));
    const hasFailures = results.some(result => result);
    if (hasFailures) {
      console.log('❌ API VALIDATION COMPLETED WITH FAILURES');
      console.log('   Note: Build continues as failOnMismatch=false');
    } else {
      console.log('✅ API VALIDATION COMPLETED SUCCESSFULLY');
    }
    console.log('='.repeat(80));
    console.log();

    return hasFailures;
  }

  private logValidationResult(serviceName: string, result: ValidationResult): void {
    if (result.errors.length > 0) {
      console.log('   ❌ RESULT: FAILED');
      console.log('   Errors:');
      result.errors.forEach(error => {
        console.log(`     • ${error.type}: ${error.message}`);
        if (error.details) {
          console.log(`       Details: ${error.details}`);
        }
      });
    } else {
      console.log('   ✅ RESULT: PASSED');
      if (result.isServiceAvailable) {
        console.log('   Service is available and API specification matches expectations');
      }
    }

    if (result.warnings.length > 0) {
      console.log('   ⚠️  WARNINGS:');
      result.warnings.forEach(warning => {
        console.log(`     • ${warning.type}: ${warning.message}`);
      });
    }

    // Additional details
    if (!result.isServiceAvailable) {
      console.log('   📊 Service Status: UNAVAILABLE');
    } else {
      console.log('   📊 Service Status: AVAILABLE');
    }

    // Log to console for build logs
    if (result.errors.length > 0) {
      console.error(`${serviceName} validation failed - see detailed output above`);
    } else {
      console.log(`${serviceName} validation passed`);
    }
  }
}

// CLI entry point
if (require.main === module) {
  const runner = new ApiValidationRunner();
  const args = process.argv.slice(2);
  runner.run(args);
}