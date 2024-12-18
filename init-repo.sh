#!/bin/bash

# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Huntress MCP Server"

# Instructions for the user
echo "Repository initialized!"
echo ""
echo "Next steps:"
echo "1. Create a new repository on GitHub"
echo "2. Run the following commands to push to your repository:"
echo "   git remote add origin https://github.com/yourusername/huntress-mcp-server.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "3. Install dependencies:"
echo "   npm install"
echo ""
echo "4. Create a .env file with your Huntress API credentials:"
echo "   cp .env.example .env"
echo "   # Then edit .env with your credentials"
echo ""
echo "5. Build the server:"
echo "   npm run build"
