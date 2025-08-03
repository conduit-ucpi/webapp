import { ApiValidator } from './ApiValidator';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

interface ApiCall {
  file: string;
  line: number;
  method: string;
  endpoint: string;
  serviceUrl: string;
  fullCall: string;
}

interface ServiceApiDocs {
  serviceName: string;
  baseUrl: string;
  openApiSpec: any;
  availableEndpoints: Array<{
    path: string;
    method: string;
    operationId?: string;
    summary?: string;
  }>;
}

export class WebappApiConformanceTest {
  private validator: ApiValidator;
  private webappRoot: string;

  constructor() {
    this.validator = new ApiValidator(30000);
    this.webappRoot = process.cwd();
  }

  async runConformanceTest(): Promise<void> {
    console.log('🔍 WEBAPP API CONFORMANCE TEST');
    console.log('='.repeat(80));
    
    try {
      // Step 1: Extract all API calls from webapp code
      console.log('\n📁 Step 1: Extracting API calls from webapp code...');
      const apiCalls = this.extractApiCallsFromWebapp();
      console.log(`   Found ${apiCalls.length} API calls across ${new Set(apiCalls.map(c => c.file)).size} files`);

      // Step 2: Fetch real API docs from services
      console.log('\n📡 Step 2: Fetching API documentation from services...');
      const serviceDocs = await this.fetchAllServiceDocs();
      console.log(`   Successfully fetched docs from ${serviceDocs.length} services`);

      // Step 3: Analyze conformance
      console.log('\n🔎 Step 3: Analyzing API conformance...');
      const conformanceResults = await this.analyzeConformance(apiCalls, serviceDocs);
      
      // Step 4: Generate report
      console.log('\n📋 Step 4: Generating conformance report...');
      this.generateConformanceReport(conformanceResults, apiCalls, serviceDocs);

    } catch (error) {
      console.error('❌ Conformance test failed:', error);
      process.exit(1);
    }
  }

  private extractApiCallsFromWebapp(): ApiCall[] {
    const apiCalls: ApiCall[] = [];
    const sourceDir = join(this.webappRoot, 'pages', 'api');
    const componentsDir = join(this.webappRoot, 'components');
    
    // Scan API routes and components
    const dirsToScan = [sourceDir, componentsDir];
    
    for (const dir of dirsToScan) {
      if (statSync(dir).isDirectory()) {
        this.scanDirectoryForApiCalls(dir, apiCalls);
      }
    }

    return apiCalls;
  }

  private scanDirectoryForApiCalls(directory: string, apiCalls: ApiCall[]): void {
    const files = readdirSync(directory);
    
    for (const file of files) {
      const filePath = join(directory, file);
      const stat = statSync(filePath);
      
      if (stat.isDirectory()) {
        this.scanDirectoryForApiCalls(filePath, apiCalls);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        this.extractApiCallsFromFile(filePath, apiCalls);
      }
    }
  }

  private extractApiCallsFromFile(filePath: string, apiCalls: ApiCall[]): void {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;
        
        // Look for fetch calls to backend services
        // Look for direct service calls
        const directServiceMatch = /fetch\(`\${process\.env\.([A-Z_]+)}\/(api\/[^`]+)`/g.exec(line);
        if (directServiceMatch) {
          const serviceEnvVar = directServiceMatch[1];
          const endpoint = directServiceMatch[2];
          const serviceUrl = process.env[serviceEnvVar] || `unknown_${serviceEnvVar}`;
          const method = this.extractHttpMethod(lines, i);
          
          apiCalls.push({
            file: filePath.replace(this.webappRoot, ''),
            line: lineNumber,
            method,
            endpoint,
            serviceUrl,
            fullCall: line.trim()
          });
        }

        // Look for webapp API proxy calls (these go through Next.js API routes)
        const proxyMatch = /fetch\(`\${[^}]+}\/(api\/[^`]+)`/g.exec(line);
        if (proxyMatch && !directServiceMatch) {
          const endpoint = proxyMatch[1];
          const method = this.extractHttpMethod(lines, i);
          
          // These are webapp API routes, mark as such
          apiCalls.push({
            file: filePath.replace(this.webappRoot, ''),
            line: lineNumber,
            method,
            endpoint,
            serviceUrl: 'webapp_api_route',
            fullCall: line.trim()
          });
        }
      }
    } catch (error) {
      console.warn(`   ⚠️  Could not read file ${filePath}: ${error}`);
    }
  }

  private extractHttpMethod(lines: string[], currentIndex: number): string {
    // Look backward and forward a few lines for method indicators
    const searchRange = 3;
    const start = Math.max(0, currentIndex - searchRange);
    const end = Math.min(lines.length - 1, currentIndex + searchRange);
    
    for (let i = start; i <= end; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('method:') || line.includes('"method"')) {
        if (line.includes('post')) return 'POST';
        if (line.includes('put')) return 'PUT';
        if (line.includes('delete')) return 'DELETE';
        if (line.includes('patch')) return 'PATCH';
      }
    }
    
    // Default to GET if no explicit method found
    return 'GET';
  }

  private async fetchAllServiceDocs(): Promise<ServiceApiDocs[]> {
    const services = [
      { name: 'User Service', url: process.env.USER_SERVICE_URL },
      { name: 'Chain Service', url: process.env.CHAIN_SERVICE_URL },
      { name: 'Contract Service', url: process.env.CONTRACT_SERVICE_URL },
    ];

    const serviceDocs: ServiceApiDocs[] = [];

    for (const service of services) {
      if (!service.url) {
        console.warn(`   ⚠️  ${service.name}: URL not configured`);
        continue;
      }

      try {
        console.log(`   📡 Fetching ${service.name} docs from ${service.url}...`);
        const openApiSpec = await this.fetchOpenApiSpec(service.url);
        
        if (openApiSpec) {
          const endpoints = this.extractEndpointsFromSpec(openApiSpec);
          serviceDocs.push({
            serviceName: service.name,
            baseUrl: service.url,
            openApiSpec,
            availableEndpoints: endpoints
          });
          console.log(`   ✅ ${service.name}: Found ${endpoints.length} endpoints`);
        } else {
          console.warn(`   ❌ ${service.name}: Could not fetch OpenAPI spec`);
        }
      } catch (error) {
        console.warn(`   ❌ ${service.name}: Error fetching docs - ${error}`);
      }
    }

    return serviceDocs;
  }

  private async fetchOpenApiSpec(serviceUrl: string): Promise<any> {
    const commonEndpoints = [
      '/v3/api-docs',
      '/api-docs',
      '/api/v3/api-docs',
      '/api/api-docs'
    ];

    for (const endpoint of commonEndpoints) {
      try {
        const response = await fetch(`${serviceUrl}${endpoint}`, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        // Continue to next endpoint
      }
    }
    
    return null;
  }

  private extractEndpointsFromSpec(openApiSpec: any): Array<{path: string, method: string, operationId?: string, summary?: string}> {
    const endpoints: Array<{path: string, method: string, operationId?: string, summary?: string}> = [];
    
    if (!openApiSpec.paths) return endpoints;
    
    for (const [path, pathItem] of Object.entries(openApiSpec.paths)) {
      const pathObj = pathItem as any;
      const methods = ['get', 'post', 'put', 'delete', 'patch'];
      
      for (const method of methods) {
        if (pathObj[method]) {
          endpoints.push({
            path,
            method: method.toUpperCase(),
            operationId: pathObj[method].operationId,
            summary: pathObj[method].summary
          });
        }
      }
    }
    
    return endpoints;
  }

  private async analyzeConformance(apiCalls: ApiCall[], serviceDocs: ServiceApiDocs[]): Promise<{
    conformingCalls: ApiCall[],
    nonConformingCalls: Array<ApiCall & {reason: string}>,
    unknownServiceCalls: ApiCall[]
  }> {
    const conformingCalls: ApiCall[] = [];
    const nonConformingCalls: Array<ApiCall & {reason: string}> = [];
    const unknownServiceCalls: ApiCall[] = [];

    for (const call of apiCalls) {
      // Find the service this call is targeting
      let targetService = serviceDocs.find(service => 
        call.serviceUrl.includes(service.baseUrl) || 
        call.serviceUrl.includes(service.serviceName.toLowerCase().replace(' ', ''))
      );

      // For webapp API routes, determine which backend service they proxy to
      if (!targetService && call.serviceUrl === 'webapp_api_route') {
        targetService = this.determineBackendServiceForWebappRoute(call.endpoint, serviceDocs);
        
        // If still no target service, validate as webapp-only route
        if (!targetService) {
          const proxyValidation = await this.validateWebappProxyRoute(call, serviceDocs);
          if (proxyValidation.isConforming) {
            conformingCalls.push(call);
            continue;
          } else {
            nonConformingCalls.push({ ...call, reason: proxyValidation.reason });
            continue;
          }
        }
      }

      if (!targetService) {
        unknownServiceCalls.push(call);
        continue;
      }

      // Check if the endpoint exists in the service's API docs
      const matchingEndpoint = targetService.availableEndpoints.find(endpoint => 
        this.pathsMatch(call.endpoint, endpoint.path) && endpoint.method === call.method
      );

      if (matchingEndpoint) {
        conformingCalls.push(call);
      } else {
        // For webapp API routes, check if they proxy to conforming backend calls
        if (call.serviceUrl === 'webapp_api_route') {
          const proxyValidation = await this.validateWebappProxyRoute(call, serviceDocs);
          if (proxyValidation.isConforming) {
            conformingCalls.push(call);
          } else {
            nonConformingCalls.push({ ...call, reason: proxyValidation.reason });
          }
        } else {
          // Check for similar endpoints
          const similarEndpoint = targetService.availableEndpoints.find(endpoint => 
            this.pathsMatch(call.endpoint, endpoint.path) ||
            endpoint.path.includes(call.endpoint.split('/').pop() || '') || 
            call.endpoint.includes(endpoint.path.split('/').pop() || '')
          );

          const reason = similarEndpoint 
            ? `Endpoint not found. Similar: ${similarEndpoint.method} ${similarEndpoint.path}`
            : `Endpoint not found in ${targetService.serviceName} API docs`;

          nonConformingCalls.push({ ...call, reason });
        }
      }
    }

    return { conformingCalls, nonConformingCalls, unknownServiceCalls };
  }

  /**
   * Validate that a webapp API route proxies to conforming backend endpoints
   */
  private async validateWebappProxyRoute(call: ApiCall, serviceDocs: ServiceApiDocs[]): Promise<{isConforming: boolean, reason: string}> {
    try {
      // Construct the expected webapp API route file path
      const routeFile = this.getWebappApiRouteFilePath(call.endpoint);
      
      if (!routeFile) {
        return { isConforming: false, reason: 'Webapp API route file not found' };
      }

      // Read and analyze the route file to find backend calls
      const backendCalls = this.extractBackendCallsFromRouteFile(routeFile);
      
      if (backendCalls.length === 0) {
        // If no backend calls, it's a webapp-only endpoint (like /api/config)
        return { isConforming: true, reason: 'Webapp-only endpoint (no backend calls)' };
      }

      // Validate each backend call
      const validationResults = backendCalls.map(backendCall => {
        const targetService = serviceDocs.find(service => 
          backendCall.serviceUrl.includes(service.baseUrl) || 
          backendCall.serviceUrl.includes(service.serviceName.toLowerCase().replace(' ', ''))
        );

        if (!targetService) {
          return { isValid: false, reason: `Unknown service: ${backendCall.serviceUrl}` };
        }

        const matchingEndpoint = targetService.availableEndpoints.find(endpoint => 
          this.pathsMatch(backendCall.endpoint, endpoint.path) && endpoint.method === backendCall.method
        );

        return { 
          isValid: !!matchingEndpoint, 
          reason: matchingEndpoint ? 'Valid' : `Backend call ${backendCall.method} ${backendCall.endpoint} not found in ${targetService.serviceName}`
        };
      });

      const allValid = validationResults.every(result => result.isValid);
      const invalidReasons = validationResults.filter(r => !r.isValid).map(r => r.reason);

      return {
        isConforming: allValid,
        reason: allValid 
          ? `Proxies to ${backendCalls.length} conforming backend endpoint(s)`
          : `Invalid backend calls: ${invalidReasons.join(', ')}`
      };

    } catch (error) {
      return { isConforming: false, reason: `Error analyzing proxy route: ${error}` };
    }
  }

  /**
   * Get the file path for a webapp API route
   */
  private getWebappApiRouteFilePath(endpoint: string): string | null {
    // Convert API endpoint to file path
    // /api/auth/login -> pages/api/auth/login.ts
    // /api/contracts/{id} -> pages/api/contracts/[id]/index.ts or pages/api/contracts/[id].ts
    
    const pathSegments = endpoint.split('/').filter(seg => seg); // Remove empty segments
    if (pathSegments[0] !== 'api') return null;

    let filePath = join(this.webappRoot, 'pages', 'api');
    
    // Handle path segments, converting {param} or ${param} to [param]
    for (let i = 1; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      if ((segment.includes('{') && segment.includes('}')) || 
          (segment.includes('${') && segment.includes('}'))) {
        // Convert {id} or ${id} to [id] - try common parameter names
        const commonParamNames = ['id', 'contractId', 'userId', 'address', 'contractAddress'];
        let foundMatch = false;
        
        for (const paramName of commonParamNames) {
          const testPath = join(filePath, `[${paramName}]`);
          const restOfPath = pathSegments.slice(i + 1);
          const fullTestPath = restOfPath.length > 0 
            ? join(testPath, ...restOfPath) + '.ts'
            : testPath + '.ts';
          
          const indexTestPath = restOfPath.length > 0 
            ? join(testPath, ...restOfPath, 'index.ts')
            : join(testPath, 'index.ts');
          
          try {
            if (statSync(fullTestPath).isFile() || statSync(indexTestPath).isFile()) {
              filePath = join(filePath, `[${paramName}]`);
              foundMatch = true;
              break;
            }
          } catch {
            // File doesn't exist, continue
          }
        }
        
        if (!foundMatch) {
          // Default fallback
          filePath = join(filePath, '[id]');
        }
      } else {
        filePath = join(filePath, segment);
      }
    }

    // Try different file extensions and patterns
    const possibleFiles = [
      `${filePath}.ts`,
      `${filePath}.js`,
      join(filePath, 'index.ts'),
      join(filePath, 'index.js')
    ];

    for (const file of possibleFiles) {
      try {
        if (statSync(file).isFile()) {
          return file;
        }
      } catch {
        // File doesn't exist, continue
      }
    }

    return null;
  }

  /**
   * Extract backend API calls from a webapp API route file
   */
  private extractBackendCallsFromRouteFile(filePath: string): Array<{method: string, endpoint: string, serviceUrl: string}> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const backendCalls: Array<{method: string, endpoint: string, serviceUrl: string}> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Look for fetch calls to backend services
        const fetchMatch = /fetch\(`\${process\.env\.([A-Z_]+)}\/(api\/[^`]+)`/.exec(line);
        if (fetchMatch) {
          const serviceEnvVar = fetchMatch[1];
          const endpoint = fetchMatch[2];
          const serviceUrl = process.env[serviceEnvVar] || `unknown_${serviceEnvVar}`;
          
          // Extract HTTP method
          const method = this.extractHttpMethodFromRouteFile(lines, i);
          
          backendCalls.push({ method, endpoint, serviceUrl });
        }
      }

      return backendCalls;
    } catch (error) {
      console.warn(`Could not analyze route file ${filePath}: ${error}`);
      return [];
    }
  }

  /**
   * Extract HTTP method from webapp API route file context
   */
  private extractHttpMethodFromRouteFile(lines: string[], currentIndex: number): string {
    // Look for method in the fetch call or nearby lines
    const searchRange = 5;
    const start = Math.max(0, currentIndex - searchRange);
    const end = Math.min(lines.length - 1, currentIndex + searchRange);
    
    for (let i = start; i <= end; i++) {
      const line = lines[i].toLowerCase();
      
      // Check for explicit method in fetch options
      if (line.includes('method:')) {
        if (line.includes("'post'") || line.includes('"post"')) return 'POST';
        if (line.includes("'put'") || line.includes('"put"')) return 'PUT';
        if (line.includes("'delete'") || line.includes('"delete"')) return 'DELETE';
        if (line.includes("'patch'") || line.includes('"patch"')) return 'PATCH';
        if (line.includes("'get'") || line.includes('"get"')) return 'GET';
      }
      
      // Check for method in fetch call itself
      if (line.includes('fetch(') && (i === currentIndex)) {
        // Look at the next few lines for method
        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
          const nextLine = lines[j].toLowerCase();
          if (nextLine.includes('method:')) {
            if (nextLine.includes('post')) return 'POST';
            if (nextLine.includes('put')) return 'PUT';
            if (nextLine.includes('delete')) return 'DELETE';
            if (nextLine.includes('patch')) return 'PATCH';
          }
        }
      }
    }
    
    // Default to GET if no explicit method found
    return 'GET';
  }

  /**
   * Determine which backend service a webapp API route proxies to
   */
  private determineBackendServiceForWebappRoute(endpoint: string, serviceDocs: ServiceApiDocs[]): ServiceApiDocs | undefined {
    // Based on endpoint patterns, determine which service it's proxying to
    if (endpoint.startsWith('api/auth/') || endpoint.startsWith('api/user/')) {
      return serviceDocs.find(s => s.serviceName === 'User Service');
    }
    if (endpoint.startsWith('api/chain/')) {
      return serviceDocs.find(s => s.serviceName === 'Chain Service');
    }
    if (endpoint.startsWith('api/contracts/') || endpoint.startsWith('api/admin/contracts/')) {
      return serviceDocs.find(s => s.serviceName === 'Contract Service');
    }
    // Special combined endpoints that might hit multiple services
    if (endpoint.includes('combined-contracts')) {
      return serviceDocs.find(s => s.serviceName === 'Contract Service');
    }
    return undefined;
  }

  /**
   * Check if a webapp path (with ${variables}) matches an OpenAPI path (with {parameters})
   */
  private pathsMatch(webappPath: string, openApiPath: string): boolean {
    // Normalize paths - ensure both start with /
    const normalizeWebappPath = webappPath.startsWith('/') ? webappPath : '/' + webappPath;
    const normalizeOpenApiPath = openApiPath.startsWith('/') ? openApiPath : '/' + openApiPath;
    
    // Direct match
    if (normalizeWebappPath === normalizeOpenApiPath) {
      return true;
    }

    // Convert both paths to comparable formats
    // Replace ${variable} with {variable} for comparison
    const normalizedWebappPath = normalizeWebappPath.replace(/\$\{[^}]+\}/g, (match) => {
      // Extract variable name from ${varName}
      const varName = match.slice(2, -1);
      return `{${varName}}`;
    });

    // Also handle cases where webapp uses specific names vs generic OpenAPI names
    const webappSegments = normalizedWebappPath.split('/');
    const openApiSegments = normalizeOpenApiPath.split('/');

    if (webappSegments.length !== openApiSegments.length) {
      return false;
    }

    for (let i = 0; i < webappSegments.length; i++) {
      const webappSeg = webappSegments[i];
      const openApiSeg = openApiSegments[i];

      // Exact match
      if (webappSeg === openApiSeg) {
        continue;
      }

      // Both are path parameters (one might be {id}, other might be {contractId})
      if (webappSeg.startsWith('{') && webappSeg.endsWith('}') && 
          openApiSeg.startsWith('{') && openApiSeg.endsWith('}')) {
        continue;
      }

      // No match
      return false;
    }

    return true;
  }

  private generateConformanceReport(
    results: {conformingCalls: ApiCall[], nonConformingCalls: Array<ApiCall & {reason: string}>, unknownServiceCalls: ApiCall[]}, 
    allCalls: ApiCall[], 
    serviceDocs: ServiceApiDocs[]
  ): void {
    console.log('\n📊 CONFORMANCE REPORT');
    console.log('='.repeat(80));
    
    const totalCalls = allCalls.length;
    const conformingCount = results.conformingCalls.length;
    const nonConformingCount = results.nonConformingCalls.length;
    const unknownCount = results.unknownServiceCalls.length;
    
    console.log(`📈 SUMMARY:`);
    console.log(`   Total API calls found: ${totalCalls}`);
    console.log(`   ✅ Conforming calls: ${conformingCount} (${Math.round(conformingCount/totalCalls*100)}%)`);
    console.log(`     - Includes direct backend calls and valid proxy routes`);
    console.log(`   ❌ Non-conforming calls: ${nonConformingCount} (${Math.round(nonConformingCount/totalCalls*100)}%)`);
    console.log(`   ❓ Unknown service calls: ${unknownCount} (${Math.round(unknownCount/totalCalls*100)}%)`);

    if (results.nonConformingCalls.length > 0) {
      console.log(`\n❌ NON-CONFORMING CALLS:`);
      for (const call of results.nonConformingCalls) {
        console.log(`   ${call.file}:${call.line}`);
        console.log(`     ${call.method} ${call.endpoint}`);
        console.log(`     Reason: ${call.reason}`);
        console.log(`     Code: ${call.fullCall}`);
        console.log('');
      }
    }

    if (results.unknownServiceCalls.length > 0) {
      console.log(`\n❓ UNKNOWN SERVICE CALLS:`);
      for (const call of results.unknownServiceCalls) {
        console.log(`   ${call.file}:${call.line}`);
        console.log(`     ${call.method} ${call.endpoint}`);
        console.log(`     Service URL: ${call.serviceUrl}`);
        console.log('');
      }
    }

    console.log(`\n📋 AVAILABLE ENDPOINTS BY SERVICE:`);
    for (const service of serviceDocs) {
      console.log(`\n🔗 ${service.serviceName} (${service.availableEndpoints.length} endpoints):`);
      for (const endpoint of service.availableEndpoints) {
        console.log(`   ${endpoint.method.padEnd(6)} ${endpoint.path}${endpoint.summary ? ' - ' + endpoint.summary : ''}`);
      }
    }

    // Exit with error if there are non-conforming calls
    if (results.nonConformingCalls.length > 0) {
      console.log(`\n❌ CONFORMANCE TEST FAILED: ${results.nonConformingCalls.length} non-conforming API calls found`);
      process.exit(1);
    } else {
      console.log(`\n✅ CONFORMANCE TEST PASSED: All API calls conform to published specifications`);
    }
  }
}

// CLI entry point
if (require.main === module) {
  const test = new WebappApiConformanceTest();
  test.runConformanceTest();
}