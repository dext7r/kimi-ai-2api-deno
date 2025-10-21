#!/bin/bash

# Start OpenAI-compatible API proxy
# Usage: ./start.sh

echo "🤖 Starting API Proxy..."
echo ""

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "Loading environment from .env"
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if port is already in use
PORT=${PORT:-9090}
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port $PORT is already in use!"
    echo "Please stop the existing process or use a different port:"
    echo "  PORT=9091 ./start.sh"
    exit 1
fi

# Display configuration
echo "Configuration:"
echo "  Port: ${PORT:-9090}"
echo "  API Key: ${API_MASTER_KEY:-未启用}"
echo "  Default Model: ${DEFAULT_MODEL:-kimi-k2-instruct-0905}"
echo "  Known Models: ${KNOWN_MODELS:-kimi-k2-instruct-0905,kimi-k2-instruct}"
echo "  Service: ${SERVICE_NAME:-kimi-ai-2api}"
echo "  Debug: ${DEBUG_MODE:-false}"
echo ""

# Start the server
deno run --allow-net --allow-env --allow-read=.env main.ts
