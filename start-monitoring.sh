#!/bin/bash

# Loki-to-Jaeger Integration Startup Script

set -e

echo "🚀 Starting Loki-to-Jaeger Integration System"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose is not installed. Please install docker-compose first.${NC}"
    exit 1
fi

# Create network if it doesn't exist
echo -e "${BLUE}📡 Creating Docker network...${NC}"
docker network create things_network 2>/dev/null || echo -e "${YELLOW}⚠️  Network 'things_network' already exists${NC}"

# Set default environment variables
export LOKI_HOSTNAME=${LOKI_HOSTNAME:-localhost}
export LOKI_PORT=${LOKI_PORT:-3100}
export JAEGER_OTLP_ENDPOINT=${JAEGER_OTLP_ENDPOINT:-http://host.docker.internal:4318}
export STACK_HOSTNAME=${STACK_HOSTNAME:-localhost}
export WEB_PORT_OUT=${WEB_PORT_OUT:-8080}
export COAP_SIMPLE_PORT_OUT=${COAP_SIMPLE_PORT_OUT:-5683}
export COAP_NEGOTIATION_PORT_OUT=${COAP_NEGOTIATION_PORT_OUT:-5684}
export MODBUS_ELEVATOR_PORT_OUT=${MODBUS_ELEVATOR_PORT_OUT:-3179}
export SMART_HOME_SMART_CLOCK_PORT_OUT=${SMART_HOME_SMART_CLOCK_PORT_OUT:-8081}
export BROKER_URI=${BROKER_URI:-test.mosquitto.org}
export HC_INTERVAL=${HC_INTERVAL:-30s}
export HC_TIMEOUT=${HC_TIMEOUT:-10s}
export HC_RETRIES=${HC_RETRIES:-3}
export HC_START_PERIOD=${HC_START_PERIOD:-40s}

echo -e "${GREEN}✅ Environment variables set${NC}"

# Install Node.js dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

# Build the integration service
echo -e "${BLUE}🔨 Building integration service...${NC}"
if [ ! -f "loki-jaeger-integration/package.json" ]; then
    echo -e "${RED}❌ Integration service files not found. Please ensure all files are in place.${NC}"
    exit 1
fi

# Check if infrastructure services are already running
echo -e "${BLUE}🔍 Checking infrastructure services...${NC}"

# Try to reach Loki
if curl -s "http://${LOKI_HOSTNAME}:${LOKI_PORT}/ready" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Loki is running at http://${LOKI_HOSTNAME}:${LOKI_PORT}${NC}"
else
    echo -e "${YELLOW}⚠️  Loki not detected at http://${LOKI_HOSTNAME}:${LOKI_PORT}${NC}"
    echo -e "${YELLOW}   Please make sure your infrastructure services are running first${NC}"
    echo -e "${YELLOW}   Continuing anyway...${NC}"
fi

# Try to reach Jaeger
if curl -s "http://localhost:16686/api/services" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Jaeger is running at http://localhost:16686${NC}"
else
    echo -e "${YELLOW}⚠️  Jaeger not detected at http://localhost:16686${NC}"
    echo -e "${YELLOW}   Please make sure your infrastructure services are running first${NC}"
    echo -e "${YELLOW}   Continuing anyway...${NC}"
fi

# Start the Things and integration service
echo -e "${BLUE}🚀 Starting Things and integration service...${NC}"
docker-compose -f docker-compose-things.yml up -d

# Wait a moment for services to start
echo -e "${BLUE}⏳ Waiting for services to start...${NC}"
sleep 5

# Check service status
echo -e "${BLUE}📊 Checking service status...${NC}"
docker-compose -f docker-compose-things.yml ps

# Display integration service logs
echo -e "${BLUE}📋 Integration service logs:${NC}"
docker-compose -f docker-compose-things.yml logs --tail=20 loki-jaeger-integration

echo ""
echo -e "${GREEN}🎉 System started successfully!${NC}"
echo "=============================================="
echo ""
echo -e "${BLUE}📊 Access Points:${NC}"
echo "  • Jaeger UI: http://localhost:16686"
echo "  • Calculator: http://localhost/http-express-calculator-simple"
echo "  • Data Schema Thing: http://localhost/http-data-schema-thing"
echo ""
echo -e "${BLUE}🔧 Useful Commands:${NC}"
echo "  • View all logs: docker-compose -f docker-compose-things.yml logs -f"
echo "  • View integration logs: docker-compose -f docker-compose-things.yml logs -f loki-jaeger-integration"
echo "  • Stop all services: docker-compose -f docker-compose-things.yml down"
echo "  • Restart integration: docker-compose -f docker-compose-things.yml restart loki-jaeger-integration"
echo ""
echo -e "${BLUE}🧪 Test the Integration:${NC}"
echo "  1. Make a request to a Thing:"
echo "     curl http://localhost/http-express-calculator-simple/properties/result"
echo ""
echo "  2. Check Jaeger UI:"
echo "     - Open http://localhost:16686"
echo "     - Select 'http-express-calculator-simple' from the service dropdown"
echo "     - Click 'Find Traces'"
echo "     - You should see traces created from the Loki logs!"
echo ""
echo -e "${GREEN}✨ Happy tracing!${NC}" 