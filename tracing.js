const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { trace } = require('@opentelemetry/api');

// Get service name from environment or use default
const serviceName = process.env.SERVICE_NAME || 'all-things';
const jaegerEndpoint = process.env.JAEGER_OTLP_ENDPOINT || 'http://localhost:4318';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    'thing.id': process.env.THING_ID || serviceName,
    'thing.type': process.env.THING_TYPE || 'iot-device',
  }),
  traceExporter: new OTLPTraceExporter({
    url: `${jaegerEndpoint}/v1/traces`,
    headers: {
      'service-name': serviceName,
    },
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Disable filesystem instrumentation to reduce noise
      },
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        requestHook: (span, request) => {
          // Add custom attributes to HTTP requests
          span.setAttributes({
            'thing.service': serviceName,
            'http.request.thing_id': process.env.THING_ID || serviceName,
          });
        },
      },
    }),
  ],
});

sdk.start();
console.log(`OpenTelemetry tracing initialized (${serviceName})`);

// Export tracer for use in applications
const tracer = trace.getTracer(serviceName);

// Helper function to create spans for Thing operations
function createThingSpan(operationName, attributes = {}) {
  return tracer.startSpan(operationName, {
    attributes: {
      'thing.service': serviceName,
      'thing.operation': operationName,
      ...attributes,
    },
  });
}

// Helper function to add Thing-specific events to spans
function addThingEvent(span, eventName, attributes = {}) {
  span.addEvent(eventName, {
    'thing.service': serviceName,
    'thing.event': eventName,
    ...attributes,
  });
}

// Export helper functions
module.exports = {
  tracer,
  createThingSpan,
  addThingEvent,
};

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log(`Tracing terminated (${serviceName})`))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
}); 