#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import http from 'http';

interface RequestParams {
  [key: string]: any;
}

interface Config {
  huntressApiKey?: string;
  huntressApiSecret?: string;
}

class HuntressServer {
  private server: Server;
  private axiosInstance: AxiosInstance | null = null;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private isAuthenticated: boolean = false;
  private authenticationPromise: Promise<void> | null = null;
  private config: Config = {};

  constructor() {
    this.server = new Server(
      {
        name: 'huntress-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Setup tool handlers
    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  // Parse configuration from query parameters (Smithery format)
  private parseConfig(queryParams: any): Config {
    const config: Config = {};
    
    // Handle dot-notation parameters from Smithery
    for (const [key, value] of Object.entries(queryParams)) {
      if (key === 'huntressApiKey') {
        config.huntressApiKey = value as string;
      } else if (key === 'huntressApiSecret') {
        config.huntressApiSecret = value as string;
      }
    }
    
    // Fallback to environment variables (Smithery configToEnv mapping)
    if (!config.huntressApiKey) {
      config.huntressApiKey = process.env.HUNTRESS_API_KEY;
    }
    if (!config.huntressApiSecret) {
      config.huntressApiSecret = process.env.HUNTRESS_API_SECRET;
    }
    
    return config;
  }

  // Non-throwing check for credentials (for discovery)
  private hasValidCredentials(): boolean {
    return !!(this.config.huntressApiKey && this.config.huntressApiSecret);
  }

  // Quick check for credentials existence (for health endpoint)
  private hasCredentials(): boolean {
    return this.hasValidCredentials();
  }

  // Ensure authentication is performed (lazy loading)
  private async ensureAuthenticated(): Promise<void> {
    if (this.isAuthenticated) {
      return;
    }

    if (this.authenticationPromise) {
      return this.authenticationPromise;
    }

    this.authenticationPromise = this.performAuthentication();
    return this.authenticationPromise;
  }

  // Perform the actual authentication
  private async performAuthentication(): Promise<void> {
    if (!this.hasValidCredentials()) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Missing required environment variables for Huntress authentication:\n' +
        '- HUNTRESS_API_KEY: Your Huntress API Key\n' +
        '- HUNTRESS_API_SECRET: Your Huntress API Secret\n\n' +
        'For setup instructions, visit: https://docs.huntress.com/api'
      );
    }

    // Initialize axios instance with base configuration
    this.axiosInstance = axios.create({
      baseURL: 'https://api.huntress.io/v1',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.huntressApiKey}:${this.config.huntressApiSecret}`).toString('base64')}`,
      },
    });

    this.isAuthenticated = true;
    this.authenticationPromise = null;
  }

  // Get tools list without any initialization (for lazy loading)
  private getToolsList() {
    return [
      {
        name: 'health_check',
        description: 'Check server status and authentication configuration without requiring credentials',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_account_info',
        description: 'Get information about the current account',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_organizations',
        description: 'List organizations in the account',
        inputSchema: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              description: 'Page number (starts at 1)',
              minimum: 1,
            },
            limit: {
              type: 'integer',
              description: 'Number of results per page (1-500)',
              minimum: 1,
              maximum: 500,
            },
          },
        },
      },
      {
        name: 'get_organization',
        description: 'Get details of a specific organization',
        inputSchema: {
          type: 'object',
          properties: {
            organization_id: {
              type: 'integer',
              description: 'Organization ID',
            },
          },
          required: ['organization_id'],
        },
      },
      {
        name: 'list_agents',
        description: 'List agents in the account',
        inputSchema: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              description: 'Page number (starts at 1)',
              minimum: 1,
            },
            limit: {
              type: 'integer',
              description: 'Number of results per page (1-500)',
              minimum: 1,
              maximum: 500,
            },
          },
        },
      },
      {
        name: 'get_agent',
        description: 'Get details of a specific agent',
        inputSchema: {
          type: 'object',
          properties: {
            agent_id: {
              type: 'integer',
              description: 'Agent ID',
            },
          },
          required: ['agent_id'],
        },
      },
      {
        name: 'list_incidents',
        description: 'List incidents in the account',
        inputSchema: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              description: 'Page number (starts at 1)',
              minimum: 1,
            },
            limit: {
              type: 'integer',
              description: 'Number of results per page (1-500)',
              minimum: 1,
              maximum: 500,
            },
            status: {
              type: 'string',
              description: 'Filter by incident status',
              enum: ['active', 'resolved', 'ignored'],
            },
          },
        },
      },
      {
        name: 'get_incident',
        description: 'Get details of a specific incident',
        inputSchema: {
          type: 'object',
          properties: {
            incident_id: {
              type: 'integer',
              description: 'Incident ID',
            },
          },
          required: ['incident_id'],
        },
      },
    ];
  }

  private async checkRateLimit() {
    const now = Date.now();
    if (now - this.lastRequestTime >= 60000) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    } else if (this.requestCount >= 60) {
      const waitTime = 60000 - (now - this.lastRequestTime);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastRequestTime = Date.now();
    }
    this.requestCount++;
  }

  private async makeRequest(endpoint: string, params: RequestParams = {}) {
    if (!this.axiosInstance) {
      throw new McpError(
        ErrorCode.InternalError,
        'Server not properly initialized'
      );
    }

    await this.checkRateLimit();
    try {
      const response = await this.axiosInstance.get(endpoint, { params });
      return response.data;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        throw new McpError(
          ErrorCode.InternalError,
          `Huntress API error: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getToolsList(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'health_check': {
            // Health check tool works without authentication (for Smithery discovery)
            const hasCredentials = this.hasValidCredentials();
            return {
              content: [
                {
                  type: 'text',
                  text: `Huntress MCP Server Health Check\n\n` +
                        `Status: ${hasCredentials ? 'Ready' : 'Requires Configuration'}\n` +
                        `Version: 1.0.0\n` +
                        `Timestamp: ${new Date().toISOString()}\n\n` +
                        `${hasCredentials ? 
                          'Server is properly configured and ready to execute tools.' : 
                          'Missing required environment variables for Huntress authentication:\n' +
                          '- HUNTRESS_API_KEY: Your Huntress API Key\n' +
                          '- HUNTRESS_API_SECRET: Your Huntress API Secret\n\n' +
                          'For setup instructions, visit: https://docs.huntress.com/api'
                        }`,
                },
              ],
            };
          }
          case 'get_account_info': {
            // Ensure authentication before making API calls (lazy loading)
            await this.ensureAuthenticated();
            const data = await this.makeRequest('/account');
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }

          case 'list_organizations': {
            // Ensure authentication before making API calls (lazy loading)
            await this.ensureAuthenticated();
            const params = {
              page: (args as any)?.page || 1,
              limit: Math.min((args as any)?.limit || 50, 500),
            };
            const data = await this.makeRequest('/organizations', params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }

          case 'get_organization': {
            // Ensure authentication before making API calls (lazy loading)
            await this.ensureAuthenticated();
            const orgId = (args as any)?.organization_id;
            if (!orgId) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'organization_id is required'
              );
            }
            const data = await this.makeRequest(`/organizations/${orgId}`);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }

          case 'list_agents': {
            // Ensure authentication before making API calls (lazy loading)
            await this.ensureAuthenticated();
            const params = {
              page: (args as any)?.page || 1,
              limit: Math.min((args as any)?.limit || 50, 500),
            };
            const data = await this.makeRequest('/agents', params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }

          case 'get_agent': {
            // Ensure authentication before making API calls (lazy loading)
            await this.ensureAuthenticated();
            const agentId = (args as any)?.agent_id;
            if (!agentId) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'agent_id is required'
              );
            }
            const data = await this.makeRequest(`/agents/${agentId}`);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }

          case 'list_incidents': {
            // Ensure authentication before making API calls (lazy loading)
            await this.ensureAuthenticated();
            const params: RequestParams = {
              page: (args as any)?.page || 1,
              limit: Math.min((args as any)?.limit || 50, 500),
            };
            const status = (args as any)?.status;
            if (status) {
              params.status = status;
            }
            const data = await this.makeRequest('/incidents', params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }

          case 'get_incident': {
            // Ensure authentication before making API calls (lazy loading)
            await this.ensureAuthenticated();
            const incidentId = (args as any)?.incident_id;
            if (!incidentId) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'incident_id is required'
              );
            }
            const data = await this.makeRequest(`/incidents/${incidentId}`);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error}`
        );
      }
    });
  }

  // Parse configuration from query parameters (Smithery HTTP format)
  private parseQueryConfig(url: string): Config {
    const config: Config = {};
    const urlObj = new URL(url, `http://localhost:${process.env.PORT || 3000}`);
    
    // Handle dot-notation parameters from Smithery
    const huntressApiKey = urlObj.searchParams.get('huntressApiKey');
    const huntressApiSecret = urlObj.searchParams.get('huntressApiSecret');
    
    if (huntressApiKey) config.huntressApiKey = huntressApiKey;
    if (huntressApiSecret) config.huntressApiSecret = huntressApiSecret;
    
    // Fallback to environment variables
    if (!config.huntressApiKey) {
      config.huntressApiKey = process.env.HUNTRESS_API_KEY;
    }
    if (!config.huntressApiSecret) {
      config.huntressApiSecret = process.env.HUNTRESS_API_SECRET;
    }
    
    return config;
  }

  async run() {
    const port = process.env.PORT || 3000;
    
    // Always use HTTP mode for Smithery container deployment
    console.error(`Starting Huntress MCP server in HTTP mode on port ${port}`);
    
    // Create HTTP server for Streamable HTTP transport
    const httpServer = http.createServer((req, res) => {
      // Set CORS headers for all responses
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }
      
      // Health check endpoint
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'ok', 
          service: 'huntress-mcp-server',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          hasCredentials: this.hasCredentials()
        }));
        return;
      }
      
      // MCP endpoint - Smithery requires /mcp endpoint specifically
      if (req.url?.startsWith('/mcp')) {
        // Parse configuration from query parameters
        this.config = this.parseQueryConfig(req.url);
        
        if (req.method === 'GET') {
          // Handle GET for simple tool discovery
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            tools: this.getToolsList()
          }));
          return;
        }
        
        if (req.method === 'POST') {
          // For Smithery, POST to /mcp should establish SSE connection
          const transport = new SSEServerTransport('/mcp', res);
          this.server.connect(transport).catch(error => {
            console.error('SSE transport error:', error);
            res.end();
          });
          return;
        }
        
        if (req.method === 'DELETE') {
          // Handle session cleanup
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'closed' }));
          return;
        }
        
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }
      
      // Default 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });
    
    httpServer.listen(port, () => {
      console.error(`Huntress MCP server running on HTTP port ${port}`);
      console.error(`MCP endpoint: http://localhost:${port}/`);
      console.error(`Health check: http://localhost:${port}/health`);
    });
  }
}

const server = new HuntressServer();
server.run().catch(console.error);
