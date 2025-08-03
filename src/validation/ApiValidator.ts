import { 
  ExpectedEndpoint, 
  ValidationResult, 
  ValidationError, 
  ValidationWarning, 
  EndpointValidation, 
  ErrorType, 
  WarningType 
} from './types';

/**
 * Core API validation logic that compares client expectations with remote OpenAPI specs.
 * TypeScript equivalent of the chainservice ApiValidator.
 */
export class ApiValidator {
  private timeoutMs: number;

  constructor(timeoutMs: number = 30000) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Validates User Service API compatibility.
   */
  async validateUserService(serviceUrl: string): Promise<ValidationResult> {
    console.log(`Validating User Service API at: ${serviceUrl}`);
    
    const { UserServiceClientSpec } = await import('./specs/UserServiceClientSpec');
    const expectedEndpoints = UserServiceClientSpec.getExpectedEndpoints();
    return this.validateService('User Service', serviceUrl, expectedEndpoints);
  }

  /**
   * Validates Chain Service API compatibility.
   */
  async validateChainService(serviceUrl: string): Promise<ValidationResult> {
    console.log(`Validating Chain Service API at: ${serviceUrl}`);
    
    const { ChainServiceClientSpec } = await import('./specs/ChainServiceClientSpec');
    const expectedEndpoints = ChainServiceClientSpec.getExpectedEndpoints();
    return this.validateService('Chain Service', serviceUrl, expectedEndpoints);
  }

  /**
   * Validates Contract Service API compatibility.
   */
  async validateContractService(serviceUrl: string): Promise<ValidationResult> {
    console.log(`Validating Contract Service API at: ${serviceUrl}`);
    
    const { ContractServiceClientSpec } = await import('./specs/ContractServiceClientSpec');
    const expectedEndpoints = ContractServiceClientSpec.getExpectedEndpoints();
    return this.validateService('Contract Service', serviceUrl, expectedEndpoints);
  }

  /**
   * Generic service validation logic.
   */
  private async validateService(
    serviceName: string,
    serviceUrl: string,
    expectedEndpoints: ExpectedEndpoint[]
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const endpointValidations: EndpointValidation[] = [];

    try {
      // Fetch OpenAPI spec
      const openApiSpec = await this.fetchOpenApiSpec(serviceUrl);
      const isServiceAvailable = openApiSpec !== null;
      
      if (!openApiSpec) {
        return {
          serviceName,
          serviceUrl,
          isServiceAvailable: false,
          errors: [{
            type: ErrorType.OPENAPI_SPEC_NOT_FOUND,
            message: 'Could not fetch OpenAPI specification from service at any common endpoints'
          }],
          warnings: []
        };
      }

      // Validate each expected endpoint
      for (const expectedEndpoint of expectedEndpoints) {
        const validation = this.validateEndpoint(openApiSpec, expectedEndpoint);
        endpointValidations.push(validation);

        if (!validation.isValid) {
          errors.push(...validation.errors.map(error => ({
            type: ErrorType.ENDPOINT_NOT_FOUND,
            message: error,
            endpoint: `${expectedEndpoint.method} ${expectedEndpoint.path}`
          })));
        }

        warnings.push(...validation.warnings.map(warning => ({
          type: WarningType.RESPONSE_FORMAT_CHANGE,
          message: warning,
          endpoint: `${expectedEndpoint.method} ${expectedEndpoint.path}`
        })));
      }

      return {
        serviceName,
        serviceUrl,
        isServiceAvailable,
        errors,
        warnings,
        validatedEndpoints: endpointValidations
      };

    } catch (error) {
      console.error(`Error validating service ${serviceName}`, error);
      return {
        serviceName,
        serviceUrl,
        isServiceAvailable: false,
        errors: [{
          type: ErrorType.NETWORK_ERROR,
          message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
          details: error instanceof Error ? error.stack : undefined
        }],
        warnings: []
      };
    }
  }

  /**
   * Fetches OpenAPI specification from a service by trying multiple common endpoint patterns.
   */
  private async fetchOpenApiSpec(serviceUrl: string): Promise<any> {
    const commonEndpoints = [
      '/api/v3/api-docs',
      '/v3/api-docs',
      '/api/api-docs',
      '/api-docs'
    ];

    for (const endpoint of commonEndpoints) {
      try {
        const fullUrl = `${serviceUrl}${endpoint}`;
        console.log(`Trying OpenAPI endpoint: ${fullUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log(`Found OpenAPI spec at: ${fullUrl}`);
          const spec = await response.json();
          return spec;
        } else {
          console.log(`OpenAPI endpoint ${fullUrl} returned HTTP ${response.status}`);
        }
      } catch (error) {
        console.log(`Failed to fetch OpenAPI spec from ${serviceUrl}${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.warn(`Could not find OpenAPI specification at any common endpoints for ${serviceUrl}`);
    console.warn(`Tried endpoints: ${commonEndpoints.join(', ')}`);
    return null;
  }

  /**
   * Validates a specific endpoint against the OpenAPI specification.
   */
  private validateEndpoint(openApi: any, expectedEndpoint: ExpectedEndpoint): EndpointValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!openApi.paths) {
        errors.push('No paths found in OpenAPI specification');
        return {
          path: expectedEndpoint.path,
          method: expectedEndpoint.method,
          isValid: false,
          errors,
          warnings
        };
      }

      const pathItem = openApi.paths[expectedEndpoint.path];
      if (!pathItem) {
        errors.push(`Path '${expectedEndpoint.path}' not found in OpenAPI specification`);
        return {
          path: expectedEndpoint.path,
          method: expectedEndpoint.method,
          isValid: false,
          errors,
          warnings
        };
      }

      const method = expectedEndpoint.method.toLowerCase();
      const operation = pathItem[method];
      
      if (!operation) {
        errors.push(`Method '${expectedEndpoint.method}' not found for path '${expectedEndpoint.path}'`);
        return {
          path: expectedEndpoint.path,
          method: expectedEndpoint.method,
          isValid: false,
          errors,
          warnings
        };
      }

      // Validate request body if expected
      if (expectedEndpoint.requestBodySchema) {
        this.validateRequestBody(operation, expectedEndpoint.requestBodySchema, errors, warnings);
      }

      // Validate response schema if expected
      if (expectedEndpoint.responseSchema) {
        this.validateResponseSchema(operation, expectedEndpoint.responseSchema, errors, warnings);
      }

      // Check for deprecated endpoint
      if (operation.deprecated === true) {
        warnings.push('Endpoint is marked as deprecated');
      }

      return {
        path: expectedEndpoint.path,
        method: expectedEndpoint.method,
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      console.error(`Error validating endpoint ${expectedEndpoint.method} ${expectedEndpoint.path}`, error);
      errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        path: expectedEndpoint.path,
        method: expectedEndpoint.method,
        isValid: false,
        errors,
        warnings
      };
    }
  }

  private validateRequestBody(
    operation: any,
    expectedSchema: Record<string, any>,
    errors: string[],
    warnings: string[]
  ): void {
    const requestBody = operation.requestBody;
    if (!requestBody) {
      if (Object.keys(expectedSchema).length > 0) {
        errors.push('Expected request body but none found in specification');
      }
      return;
    }

    const content = requestBody.content?.['application/json'];
    if (!content) {
      errors.push('Expected JSON request body but not found in specification');
      return;
    }

    // Basic schema validation - can be enhanced further
    const schema = content.schema;
    if (!schema) {
      warnings.push('Request body schema not defined');
    }
  }

  private validateResponseSchema(
    operation: any,
    expectedSchema: Record<string, any>,
    errors: string[],
    warnings: string[]
  ): void {
    const responses = operation.responses;
    if (!responses || Object.keys(responses).length === 0) {
      errors.push('No response definitions found');
      return;
    }

    const successResponse = responses['200'] || responses['201'];
    if (!successResponse) {
      warnings.push('No success response (200/201) defined');
      return;
    }

    const content = successResponse.content?.['application/json'];
    if (!content) {
      warnings.push('No JSON response content defined for success response');
      return;
    }

    // Basic schema validation - can be enhanced further
    const schema = content.schema;
    if (!schema) {
      warnings.push('Response schema not defined');
    }
  }
}