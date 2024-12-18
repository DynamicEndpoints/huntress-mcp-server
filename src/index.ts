#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';

// Environment variables for authentication
const API_KEY = process.env.HUNTRESS_API_KEY;
const API_SECRET = process.env.HUNTRESS_API_SECRET;

if (!API_KEY || !API_SECRET) {
  throw new Error('HUNTRESS_API_KEY and HUNTRESS_API_SECRET environment variables are required');
}

interface RequestParams {
  [key: string]: any;
}

class HuntressServer {
  private server: Server;
  private axiosInstance: AxiosInstance;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;

  constructor() {
    this.server = new Server(
      {
        name: 'huntress-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize axios instance with base configuration
    this.axiosInstance = axios.create({
      baseURL: 'https://api.huntress.io/v1',
      headers: {
        Authorization: `Basic ${Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64')}`,
      },
    });

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async checkRateLimit() {
    const now = Date.now();
    if (now - this.lastRequestTime >= 60000) {
      // Reset if a minute has passed
      this.requestCount = 0;
      this.lastRequestTime = now;
    } else if (this.requestCount >= 60) {
      // Wait until a minute has passed since first request
      const waitTime = 60000 - (now - this.lastRequestTime);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastRequestTime = Date.now();
    }
    this.requestCount++;
  }

  private async makeRequest(endpoint: string, params: RequestParams = {}) {
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
      tools: [
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
              organization_id: {
                type: 'integer',
                description: 'Filter by organization ID',
              },
              platform: {
                type: 'string',
                description: 'Filter by platform (darwin or windows)',
                enum: ['darwin', 'windows'],
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
          name: 'list_incident_reports',
          description: 'List incident reports',
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
              organization_id: {
                type: 'integer',
                description: 'Filter by organization ID',
              },
              status: {
                type: 'string',
                description: 'Filter by status',
                enum: ['sent', 'closed', 'dismissed'],
              },
              severity: {
                type: 'string',
                description: 'Filter by severity',
                enum: ['low', 'high', 'critical'],
              },
            },
          },
        },
        {
          name: 'get_incident_report',
          description: 'Get details of a specific incident report',
          inputSchema: {
            type: 'object',
            properties: {
              report_id: {
                type: 'integer',
                description: 'Incident Report ID',
              },
            },
            required: ['report_id'],
          },
        },
        {
          name: 'list_summary_reports',
          description: 'List summary reports',
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
              organization_id: {
                type: 'integer',
                description: 'Filter by organization ID',
              },
              type: {
                type: 'string',
                description: 'Filter by report type',
                enum: ['monthly_summary', 'quarterly_summary', 'yearly_summary'],
              },
            },
          },
        },
        {
          name: 'get_summary_report',
          description: 'Get details of a specific summary report',
          inputSchema: {
            type: 'object',
            properties: {
              report_id: {
                type: 'integer',
                description: 'Summary Report ID',
              },
            },
            required: ['report_id'],
          },
        },
        {
          name: 'list_billing_reports',
          description: 'List billing reports',
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
                description: 'Filter by status',
                enum: ['open', 'paid', 'failed', 'partial_refund', 'full_refund'],
              },
            },
          },
        },
        {
          name: 'get_billing_report',
          description: 'Get details of a specific billing report',
          inputSchema: {
            type: 'object',
            properties: {
              report_id: {
                type: 'integer',
                description: 'Billing Report ID',
              },
            },
            required: ['report_id'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      try {
        let response;
        switch (name) {
          case 'get_account_info':
            response = await this.makeRequest('/account');
            break;

          case 'list_organizations':
            response = await this.makeRequest('/organizations', args);
            break;

          case 'get_organization':
            if (!args.organization_id) {
              throw new McpError(ErrorCode.InvalidParams, 'organization_id is required');
            }
            response = await this.makeRequest(`/organizations/${args.organization_id}`);
            break;

          case 'list_agents':
            response = await this.makeRequest('/agents', args);
            break;

          case 'get_agent':
            if (!args.agent_id) {
              throw new McpError(ErrorCode.InvalidParams, 'agent_id is required');
            }
            response = await this.makeRequest(`/agents/${args.agent_id}`);
            break;

          case 'list_incident_reports':
            response = await this.makeRequest('/incident_reports', args);
            break;

          case 'get_incident_report':
            if (!args.report_id) {
              throw new McpError(ErrorCode.InvalidParams, 'report_id is required');
            }
            response = await this.makeRequest(`/incident_reports/${args.report_id}`);
            break;

          case 'list_summary_reports':
            response = await this.makeRequest('/reports', args);
            break;

          case 'get_summary_report':
            if (!args.report_id) {
              throw new McpError(ErrorCode.InvalidParams, 'report_id is required');
            }
            response = await this.makeRequest(`/reports/${args.report_id}`);
            break;

          case 'list_billing_reports':
            response = await this.makeRequest('/billing_reports', args);
            break;

          case 'get_billing_report':
            if (!args.report_id) {
              throw new McpError(ErrorCode.InvalidParams, 'report_id is required');
            }
            response = await this.makeRequest(`/billing_reports/${args.report_id}`);
            break;

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing ${name}: ${error}`
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Huntress MCP server running on stdio');
  }
}

const server = new HuntressServer();
server.run().catch(console.error);
