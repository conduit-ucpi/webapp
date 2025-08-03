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
      const conformanceResults = this.analyzeConformance(apiCalls, serviceDocs);
      
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
        const fetchMatches = [
          // Direct service calls
          /fetch\(`\${process\.env\.([A-Z_]+)}\/(api\/[^`]+)`/g,
          // Proxy calls through webapp API routes
          /fetch\(`\${[^}]+}\/(api\/[^`]+)`/g,
        ];

        for (const regex of fetchMatches) {
          let match;
          while ((match = regex.exec(line)) !== null) {
            const serviceEnvVar = match[1];
            const endpoint = match[2] || match[1];
            
            let serviceUrl = '';
            if (serviceEnvVar) {
              serviceUrl = process.env[serviceEnvVar] || `unknown_${serviceEnvVar}`;
            }
            
            // Extract HTTP method from context
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

  private analyzeConformance(apiCalls: ApiCall[], serviceDocs: ServiceApiDocs[]): {
    conformingCalls: ApiCall[],
    nonConformingCalls: Array<ApiCall & {reason: string}>,
    unknownServiceCalls: ApiCall[]
  } {
    const conformingCalls: ApiCall[] = [];
    const nonConformingCalls: Array<ApiCall & {reason: string}> = [];
    const unknownServiceCalls: ApiCall[] = [];

    for (const call of apiCalls) {
      // Find the service this call is targeting
      const targetService = serviceDocs.find(service => 
        call.serviceUrl.includes(service.baseUrl) || 
        call.serviceUrl.includes(service.serviceName.toLowerCase().replace(' ', ''))
      );

      if (!targetService) {
        unknownServiceCalls.push(call);
        continue;
      }

      // Check if the endpoint exists in the service's API docs
      const matchingEndpoint = targetService.availableEndpoints.find(endpoint => 
        endpoint.path === call.endpoint && endpoint.method === call.method
      );

      if (matchingEndpoint) {
        conformingCalls.push(call);
      } else {
        // Check for similar endpoints
        const similarEndpoint = targetService.availableEndpoints.find(endpoint => 
          endpoint.path.includes(call.endpoint.split('/').pop() || '') || 
          call.endpoint.includes(endpoint.path.split('/').pop() || '')
        );

        const reason = similarEndpoint 
          ? `Endpoint not found. Similar: ${similarEndpoint.method} ${similarEndpoint.path}`
          : `Endpoint not found in ${targetService.serviceName} API docs`;

        nonConformingCalls.push({ ...call, reason });
      }
    }

    return { conformingCalls, nonConformingCalls, unknownServiceCalls };
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