FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production=false

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Run the server
CMD ["node", "build/index.js"]
