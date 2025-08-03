/**
 * TypeScript types for API validation - webapp equivalent of chainservice validation
 */

export interface ExpectedEndpoint {
  path: string;
  method: string;
  description: string;
  requestBodySchema?: Record<string, any>;
  responseSchema?: Record<string, any>;
  requiresAuthentication?: boolean;
  tags?: string[];
}

export interface ValidationError {
  type: ErrorType;
  message: string;
  endpoint?: string;
  details?: string;
}

export interface ValidationWarning {
  type: WarningType;
  message: string;
  endpoint?: string;
}

export interface EndpointValidation {
  path: string;
  method: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationResult {
  serviceName: string;
  serviceUrl: string;
  isServiceAvailable: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  validatedEndpoints?: EndpointValidation[];
}

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  OPENAPI_SPEC_NOT_FOUND = 'OPENAPI_SPEC_NOT_FOUND',
  ENDPOINT_NOT_FOUND = 'ENDPOINT_NOT_FOUND',
  SCHEMA_MISMATCH = 'SCHEMA_MISMATCH',
  METHOD_NOT_SUPPORTED = 'METHOD_NOT_SUPPORTED'
}

export enum WarningType {
  RESPONSE_FORMAT_CHANGE = 'RESPONSE_FORMAT_CHANGE',
  DEPRECATED_ENDPOINT = 'DEPRECATED_ENDPOINT',
  OPTIONAL_FIELD_MISSING = 'OPTIONAL_FIELD_MISSING'
}

export interface ApiValidationConfig {
  enabled: boolean;
  failOnMismatch: boolean;
  timeout: number;
  environment: 'development' | 'test' | 'production';
}