#!/bin/bash

# TechMentor Voice - Quick Setup Script
# Run: chmod +x setup.sh && ./setup.sh

echo "🏆 Setting up TechMentor Voice - AssemblyAI Challenge Winner"
echo "=================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION detected. Please upgrade to Node.js 18+."
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "🔧 Creating environment file..."
    cp .env.local.example .env.local 2>/dev/null || cat > .env.local << 'EOF'
# AssemblyAI Universal-Streaming (REQUIRED)
NEXT_PUBLIC_ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

# Google Gemini 2.0 Flash (REQUIRED)
GEMINI_API_KEY=your_gemini_api_key_here

# ElevenLabs TTS (OPTIONAL - fallback to Web Speech if not provided)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Context7 MCP Remote Endpoint (Already configured - no key needed)
NEXT_PUBLIC_MCP_ENDPOINT=https://mcp.context7.com/mcp

# Application Settings
NEXT_PUBLIC_APP_NAME=TechMentor Voice
NEXT_PUBLIC_APP_VERSION=1.0.0
EOF
    echo "✅ Created .env.local file"
else
    echo "✅ .env.local file already exists"
fi

# Check API keys
echo ""
echo "🔑 API Key Setup Required:"
echo "================================"
echo ""
echo "1. AssemblyAI (REQUIRED):"
echo "   → Sign up: https://www.assemblyai.com/dashboard/signup"
echo "   → Get free API key ($50 credit included)"
echo "   → Add to .env.local: NEXT_PUBLIC_ASSEMBLYAI_API_KEY=your_key"
echo ""
echo "2. Google Gemini (REQUIRED):"
echo "   → Visit: https://ai.google.dev/"
echo "   → Create API key for Gemini 2.0 Flash"
echo "   → Add to .env.local: GEMINI_API_KEY=your_key"
echo ""
echo "3. ElevenLabs (OPTIONAL):"
echo "   → Sign up: https://elevenlabs.io/"
echo "   → Get API key (free tier available)"
echo "   → Add to .env.local: ELEVENLABS_API_KEY=your_key"
echo "   → Note: Will fallback to Web Speech API if not provided"
echo ""

# Check if API keys are configured
if grep -q "your_.*_api_key_here" .env.local; then
    echo "⚠️  Please configure your API keys in .env.local before running the app"
    echo ""
    echo "Edit the file: nano .env.local"
    echo "Or use your preferred editor to add the API keys"
else
    echo "✅ API keys appear to be configured"
fi

echo ""
echo "🚀 Quick Start Commands:"
echo "========================"
echo ""
echo "1. Configure API keys (if not done):"
echo "   nano .env.local"
echo ""
echo "2. Start development server:"
echo "   npm run dev"
echo ""
echo "3. Open browser:"
echo "   http://localhost:3000"
echo ""
echo "4. Deploy to Cloudflare (after testing):"
echo "   npm run deploy"
echo ""

# Try to start development server
read -p "🎯 Start development server now? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Starting TechMentor Voice..."
    echo "Open http://localhost:3000 in your browser"
    echo "Press Ctrl+C to stop the server"
    echo ""
    npm run dev
else
    echo "✅ Setup complete! Run 'npm run dev' when ready to start."
fi