const axios = require('axios');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { trace } = require('@opentelemetry/api');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const LOKI_URL = process.env.LOKI_URL || 'http://localhost:3100';
const JAEGER_OTLP_ENDPOINT = process.env.JAEGER_OTLP_ENDPOINT || 'http://localhost:4318';
const POLLING_INTERVAL = parseInt(process.env.POLLING_INTERVAL || '10000');

console.log('🚀 Starting Loki-to-Jaeger Integration Service');
console.log(`📊 Loki URL: ${LOKI_URL}`);
console.log(`📈 Jaeger OTLP Endpoint: ${JAEGER_OTLP_ENDPOINT}`);
console.log(`⏱️  Polling Interval: ${POLLING_INTERVAL}ms`);

// Initialize OpenTelemetry SDK for sending traces
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'loki-jaeger-integration',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: `${JAEGER_OTLP_ENDPOINT}/v1/traces`,
  }),
});

sdk.start();
const tracer = trace.getTracer('loki-jaeger-integration');

// Keep track of processed log entries to avoid duplicates
const processedEntries = new Set();

// Map of thing names to their current active spans
const activeSpans = new Map();

async function queryLoki(query, start, end) {
  try {
    const response = await axios.get(`${LOKI_URL}/loki/api/v1/query_range`, {
      params: {
        query: query,
        start: start,
        end: end,
        limit: 1000,
      },
    });
    
    return response.data.data.result || [];
  } catch (error) {
    console.error('❌ Error querying Loki:', error.message);
    return [];
  }
}

function parseLogEntry(logLine) {
  try {
    const parsed = JSON.parse(logLine);
    return {
      timestamp: parsed.timestamp,
      level: parsed.level,
      message: parsed.message,
      labels: parsed.labels || {},
      ...parsed,
    };
  } catch (error) {
    // If JSON parsing fails, treat as plain text
    return {
      message: logLine,
      labels: {},
    };
  }
}

function createSpanName(logEntry) {
  const { labels } = logEntry;
  
  if (labels.affordance && labels.affordanceName) {
    const op = labels.op || labels.messageType || 'operation';
    return `${labels.affordance}:${labels.affordanceName}:${op}`;
  }
  
  return labels.messageType || 'thing-operation';
}

function getSpanAttributes(logEntry) {
  const { labels, message, level } = logEntry;
  
  return {
    'log.message': message,
    'log.level': level,
    'thing.name': labels.thing || 'unknown',
    'thing.affordance': labels.affordance || '',
    'thing.affordanceName': labels.affordanceName || '',
    'thing.operation': labels.op || labels.messageType || '',
    'thing.messageType': labels.messageType || '',
    ...Object.fromEntries(
      Object.entries(labels).map(([key, value]) => [`thing.${key}`, value])
    ),
  };
}

async function createTraceFromLogs(thingName, logEntries) {
  if (logEntries.length === 0) return;

  // Sort entries by timestamp
  logEntries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Group related operations together
  const operationGroups = groupOperationsByTimeWindow(logEntries);

  for (const group of operationGroups) {
    await createTraceSpan(thingName, group);
  }
}

function groupOperationsByTimeWindow(logEntries, windowMs = 5000) {
  const groups = [];
  let currentGroup = [];
  let groupStartTime = null;

  for (const entry of logEntries) {
    const entryTime = new Date(entry.timestamp);
    
    if (!groupStartTime || entryTime - groupStartTime > windowMs) {
      if (currentGroup.length > 0) {
        groups.push([...currentGroup]);
      }
      currentGroup = [entry];
      groupStartTime = entryTime;
    } else {
      currentGroup.push(entry);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

async function createTraceSpan(thingName, logEntries) {
  const firstEntry = logEntries[0];
  const lastEntry = logEntries[logEntries.length - 1];
  
  const spanName = createSpanName(firstEntry);
  const startTime = new Date(firstEntry.timestamp);
  const endTime = new Date(lastEntry.timestamp);
  
  const span = tracer.startSpan(spanName, {
    startTime: startTime,
    attributes: {
      'service.name': thingName,
      'operation.count': logEntries.length,
      'operation.duration_ms': endTime - startTime,
    },
  });

  // Add events for each log entry
  for (const entry of logEntries) {
    const attributes = getSpanAttributes(entry);
    span.addEvent(entry.message, attributes, new Date(entry.timestamp));
  }

  // Set span attributes from the first entry
  const spanAttributes = getSpanAttributes(firstEntry);
  span.setAttributes(spanAttributes);

  span.end(endTime);
  
  console.log(`📋 Created trace span: ${spanName} for ${thingName} (${logEntries.length} events)`);
}

async function processLokiLogs() {
  console.log('🔍 Querying Loki for new logs...');
  
  // Query for the last 30 seconds of logs
  const now = Date.now();
  const thirtySecondsAgo = now - 30000;
  
  const startTime = thirtySecondsAgo * 1000000; // Convert to nanoseconds
  const endTime = now * 1000000; // Convert to nanoseconds
  
  // Query for all thing logs
  const query = '{thing=~".+"} | json';
  const results = await queryLoki(query, startTime, endTime);
  
  // Group logs by thing
  const logsByThing = new Map();
  
  for (const result of results) {
    const thingName = result.stream.thing;
    if (!thingName) continue;
    
    const entries = result.values
      .map(([timestamp, logLine]) => {
        const entryId = `${thingName}-${timestamp}-${logLine}`;
        if (processedEntries.has(entryId)) {
          return null; // Skip already processed entries
        }
        processedEntries.add(entryId);
        
        const parsed = parseLogEntry(logLine);
        return {
          ...parsed,
          timestamp: new Date(parseInt(timestamp) / 1000000), // Convert from nanoseconds
        };
      })
      .filter(entry => entry !== null);
    
    if (entries.length > 0) {
      if (!logsByThing.has(thingName)) {
        logsByThing.set(thingName, []);
      }
      logsByThing.get(thingName).push(...entries);
    }
  }
  
  // Create traces for each thing
  for (const [thingName, entries] of logsByThing) {
    await createTraceFromLogs(thingName, entries);
  }
  
  console.log(`✅ Processed logs for ${logsByThing.size} things`);
}

async function cleanup() {
  console.log('🧹 Cleaning up old processed entries...');
  
  // Keep only the last 10000 entries to prevent memory leaks
  if (processedEntries.size > 10000) {
    const entries = Array.from(processedEntries);
    processedEntries.clear();
    // Keep the last 5000 entries
    entries.slice(-5000).forEach(entry => processedEntries.add(entry));
  }
}

function startPolling() {
  console.log('🔄 Starting polling loop...');
  
  // Initial processing
  processLokiLogs().catch(console.error);
  
  // Set up regular polling
  setInterval(async () => {
    try {
      await processLokiLogs();
    } catch (error) {
      console.error('❌ Error processing logs:', error);
    }
  }, POLLING_INTERVAL);
  
  // Clean up every 5 minutes
  setInterval(cleanup, 5 * 60 * 1000);
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  await sdk.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  await sdk.shutdown();
  process.exit(0);
});

// Start the service
startPolling(); 