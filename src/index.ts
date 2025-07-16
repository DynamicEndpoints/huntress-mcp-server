#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import axios, { AxiosInstance } from 'axios';

// Configuration schema for Smithery
export const configSchema = z.object({
  huntressApiKey: z.string().describe("Your Huntress API Key"),
  huntressApiSecret: z.string().describe("Your Huntress API Secret"),
  debug: z.boolean().default(false).describe("Enable debug logging")
});

export default function ({ config }: { config: z.infer<typeof configSchema> }) {
  const server = new McpServer({
    name: 'Huntress MCP Server',
    version: '1.0.0'
  });

  // Lazy-loaded axios instance
  let axiosInstance: AxiosInstance | null = null;
  let lastRequestTime = 0;
  let requestCount = 0;

  // Initialize axios instance only when needed
  const getAxiosInstance = () => {
    if (!axiosInstance) {
      axiosInstance = axios.create({
        baseURL: 'https://api.huntress.io/v1',
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.huntressApiKey}:${config.huntressApiSecret}`).toString('base64')}`,
        },
      });
    }
    return axiosInstance;
  };

  // Rate limiting helper
  const checkRateLimit = async () => {
    const now = Date.now();
    if (now - lastRequestTime >= 60000) {
      requestCount = 0;
      lastRequestTime = now;
    } else if (requestCount >= 60) {
      const waitTime = 60000 - (now - lastRequestTime);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      requestCount = 0;
      lastRequestTime = Date.now();
    }
    requestCount++;
  };

  // API request helper
  const makeRequest = async (endpoint: string, params: any = {}) => {
    await checkRateLimit();
    const client = getAxiosInstance();
    
    try {
      const response = await client.get(endpoint, { params });
      return response.data;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Huntress API error: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  };

  // Health check tool (works without full config for discovery)
  server.tool(
    'health_check',
    'Check server status and authentication configuration',
    {},
    async () => {
      const hasCredentials = !!(config.huntressApiKey && config.huntressApiSecret);
      return {
        content: [{
          type: 'text',
          text: `Huntress MCP Server Health Check\n\n` +
                `Status: ${hasCredentials ? 'Ready' : 'Requires Configuration'}\n` +
                `Version: 1.0.0\n` +
                `Timestamp: ${new Date().toISOString()}\n\n` +
                `${hasCredentials ? 
                  'Server is properly configured and ready to execute tools.' : 
                  'Missing required configuration:\n' +
                  '- huntressApiKey: Your Huntress API Key\n' +
                  '- huntressApiSecret: Your Huntress API Secret\n\n' +
                  'For setup instructions, visit: https://docs.huntress.com/api'
                }`
        }]
      };
    }
  );

  // Get account information
  server.tool(
    'get_account_info',
    'Get information about the current account',
    {},
    async () => {
      const data = await makeRequest('/account');
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }]
      };
    }
  );

  // List organizations
  server.tool(
    'list_organizations',
    'List organizations in the account',
    {
      page: z.number().min(1).default(1).describe('Page number (starts at 1)'),
      limit: z.number().min(1).max(500).default(50).describe('Number of results per page (1-500)')
    },
    async ({ page, limit }) => {
      const data = await makeRequest('/organizations', { page, limit });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }]
      };
    }
  );

  // Get organization details
  server.tool(
    'get_organization',
    'Get details of a specific organization',
    {
      organization_id: z.number().describe('Organization ID')
    },
    async ({ organization_id }) => {
      const data = await makeRequest(`/organizations/${organization_id}`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }]
      };
    }
  );

  // List agents
  server.tool(
    'list_agents',
    'List agents in the account',
    {
      page: z.number().min(1).default(1).describe('Page number (starts at 1)'),
      limit: z.number().min(1).max(500).default(50).describe('Number of results per page (1-500)')
    },
    async ({ page, limit }) => {
      const data = await makeRequest('/agents', { page, limit });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }]
      };
    }
  );

  // Get agent details
  server.tool(
    'get_agent',
    'Get details of a specific agent',
    {
      agent_id: z.number().describe('Agent ID')
    },
    async ({ agent_id }) => {
      const data = await makeRequest(`/agents/${agent_id}`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }]
      };
    }
  );

  // List incidents
  server.tool(
    'list_incidents',
    'List incidents in the account',
    {
      page: z.number().min(1).default(1).describe('Page number (starts at 1)'),
      limit: z.number().min(1).max(500).default(50).describe('Number of results per page (1-500)'),
      status: z.enum(['active', 'resolved', 'ignored']).optional().describe('Filter by incident status')
    },
    async ({ page, limit, status }) => {
      const params: any = { page, limit };
      if (status) params.status = status;
      
      const data = await makeRequest('/incidents', params);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }]
      };
    }
  );

  // Get incident details
  server.tool(
    'get_incident',
    'Get details of a specific incident',
    {
      incident_id: z.number().describe('Incident ID')
    },
    async ({ incident_id }) => {
      const data = await makeRequest(`/incidents/${incident_id}`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }]
      };
    }
  );

  return server.server;
}