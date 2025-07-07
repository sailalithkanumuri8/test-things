#!/bin/bash

# Migration script to convert all things from Loki to OpenTelemetry tracing

echo "🚀 Starting migration from Loki to OpenTelemetry tracing..."
echo ""

# Run the migration script
node scripts/migrate-to-tracing.js

echo ""
echo "✅ Migration script completed!"
echo ""
echo "📋 Next steps:"
echo "  1. Install tracing dependencies:"
echo "     cd util && npm install"
echo ""
echo "  2. Start Jaeger:"
echo "     docker-compose -f docker-compose-tracing.yml up -d"
echo ""
echo "  3. Run your things and view traces at:"
echo "     http://localhost:16686"
echo ""
echo "🎉 All things now use OpenTelemetry tracing!" 