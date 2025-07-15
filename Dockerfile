FROM node:22-slim

WORKDIR /app

# Install wget for health check
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Install Smithery CLI and build for deployment
RUN npx -y @smithery/cli@1.2.14 build -o .smithery/index.cjs

# Expose port for MCP server
EXPOSE 3000

# Health check for MCP server
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Run the server
CMD ["node", ".smithery/index.cjs"]
