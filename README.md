# Huntress API MCP Server
[![smithery badge](https://smithery.ai/badge/huntress-mcp-server)](https://smithery.ai/server/huntress-mcp-server)

A Model Context Protocol (MCP) server that provides tools for interacting with the Huntress API. This server enables programmatic access to Huntress functionality including account management, organization management, agent management, incident reports, and more.

<a href="https://glama.ai/mcp/servers/hry99k6xc2"><img width="380" height="200" src="https://glama.ai/mcp/servers/hry99k6xc2/badge" alt="Huntress-MCP-Server MCP server" /></a>

## Features

- **Latest MCP SDK 1.15.1**: Built with the latest Model Context Protocol features
- **Deferred Initialization**: Optimized for Smithery deployment with lazy loading
- **Container Support**: Ready for containerized deployment via Smithery
- **HTTP/SSE Transport**: Supports both stdio and HTTP/SSE modes
- **CORS Enabled**: Full CORS support for browser-based MCP clients
- **Health Check**: Built-in health check endpoint for container orchestration
- **Rate Limiting**: Built-in rate limiting (60 requests per minute)
- **Comprehensive Error Handling**: Detailed error messages and validation
- **Session Management**: Compatible with Smithery's tool discovery process

## Installation

### Installing via Smithery

To install Huntress API MCP Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/huntress-mcp-server):

```bash
npx -y @smithery/cli install huntress-mcp-server --client claude
```

### Manual Installation
1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Create a `.env` file based on `.env.example`:
```bash
HUNTRESS_API_KEY=your_api_key_here
HUNTRESS_API_SECRET=your_api_secret_here
```
4. Build the server:
```bash
npm run build
```

## Available Tools

### Account Management
- `get_account_info`: Get information about the current account

### Organization Management
- `list_organizations`: List organizations in the account (supports pagination)
- `get_organization`: Get details of a specific organization

### Agent Management
- `list_agents`: List agents in the account (supports pagination)
- `get_agent`: Get details of a specific agent

### Incident Management
- `list_incidents`: List incidents in the account (supports pagination and status filtering)
- `get_incident`: Get details of a specific incident

## Configuration

The server requires the following environment variables:

- `HUNTRESS_API_KEY`: Your Huntress API Key
- `HUNTRESS_API_SECRET`: Your Huntress API Secret Key

These can be obtained from your Huntress account at `<your_account_subdomain>.huntress.io` under API Credentials.

## Usage with MCP

### Local Development (stdio mode)
Add the following configuration to your MCP settings:

```json
{
  "mcpServers": {
    "huntress": {
      "command": "node",
      "args": ["path/to/huntress-server/build/index.js"],
      "env": {
        "HUNTRESS_API_KEY": "your_api_key_here",
        "HUNTRESS_API_SECRET": "your_api_secret_here"
      }
    }
  }
}
```

### Container/HTTP Mode
When running in container mode, the server exposes:
- **HTTP Endpoint**: `http://localhost:3000/` (POST for MCP requests)
- **SSE Endpoint**: `http://localhost:3000/sse` (Server-Sent Events)
- **Health Check**: `http://localhost:3000/health` (GET for health status)

## Rate Limiting

The server implements Huntress API's rate limiting of 60 requests per minute on a sliding window. This means:
- No more than 60 requests can be made within any 60-second period
- The window slides, so if request 1 is made at T0 and request 60 at T30, request 61 must wait until T60

## Smithery Deployment

This server is optimized for deployment on [Smithery](https://smithery.ai) using **container deployment**, featuring:

- **Container Runtime**: Uses Docker container with HTTP streaming (SSE)
- **HTTP Endpoint**: Implements `/` endpoint for MCP communication
- **Environment Variable Configuration**: Maps configuration to environment variables
- **Deferred Initialization**: Credentials are only loaded when tools are actually invoked
- **Tool Discovery**: Tools can be listed without requiring authentication

### Smithery Configuration
The `smithery.yaml` uses:
- `runtime: "container"` for Docker container deployment
- **HTTP streaming**: Server-Sent Events (SSE) for real-time communication
- **Environment variable mapping**: Maps configuration to `HUNTRESS_API_KEY` and `HUNTRESS_API_SECRET`
- **Lazy loading**: Tools discoverable without authentication

### Deployment Steps
1. **Push to GitHub**: Ensure your code is in a GitHub repository
2. **Connect to Smithery**: Visit https://smithery.ai and connect your GitHub
3. **Deploy**: Use Smithery's container deployment for automatic building

## Latest MCP Features (v1.15.1)

This server leverages the latest MCP SDK features including:

- **Enhanced Error Handling**: Improved error validation and reporting
- **CORS Support**: For browser-based MCP clients
- **Session Lifecycle Hooks**: Better session management
- **OAuth Improvements**: Enhanced authentication methods
- **Async Callback Support**: For session initialization and cleanup
- **Custom Headers**: Support for custom authentication headers
- **Streamable HTTP Transport**: Support for HTTP/SSE transport modes
- **HTTP Endpoint**: `/mcp` endpoint with proper REST methods

## HTTP Endpoint Details

When running in HTTP mode (Smithery deployment), the server exposes:

- **MCP Endpoint**: `http://localhost:3000/mcp`
  - **GET**: Returns server capabilities for tool discovery
  - **POST**: Handles MCP tool calls
  - **DELETE**: Handles session cleanup
- **Health Check**: `http://localhost:3000/health`
- **Configuration**: Via query parameters (`?huntressApiKey=xxx&huntressApiSecret=yyy`)

## Docker Support (Legacy)

For custom container deployment:

### Build Docker Image
```bash
docker build -t huntress-mcp-server .
```

### Run Docker Container
```bash
docker run -p 3000:3000 \
  -e HUNTRESS_API_KEY=your_api_key_here \
  -e HUNTRESS_API_SECRET=your_api_secret_here \
  huntress-mcp-server
```

## Error Handling

The server handles various error scenarios:
- Invalid API credentials
- Rate limit exceeded
- Invalid request parameters
- API response errors
- Session management errors
- Tool discovery failures
- Container health issues

## Development

### Local Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Clean
```bash
npm run clean
```

## License

MIT License - See LICENSE file for details
