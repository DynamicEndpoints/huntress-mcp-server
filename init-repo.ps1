# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Huntress MCP Server"

# Instructions for the user
Write-Host "Repository initialized!"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Create a new repository on GitHub"
Write-Host "2. Run the following commands to push to your repository:"
Write-Host "   git remote add origin https://github.com/yourusername/huntress-mcp-server.git"
Write-Host "   git branch -M main"
Write-Host "   git push -u origin main"
Write-Host ""
Write-Host "3. Install dependencies:"
Write-Host "   npm install"
Write-Host ""
Write-Host "4. Create a .env file with your Huntress API credentials:"
Write-Host "   Copy-Item .env.example .env"
Write-Host "   # Then edit .env with your credentials"
Write-Host ""
Write-Host "5. Build the server:"
Write-Host "   npm run build"
