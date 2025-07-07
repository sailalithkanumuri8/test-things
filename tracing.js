const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

const serviceName = process.env.OTEL_SERVICE_NAME || 'all-things';
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';

const sdk = new NodeSDK({
  serviceName,
  traceExporter: new OTLPTraceExporter({
    url: otlpEndpoint,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
console.log(`OpenTelemetry tracing initialized (${serviceName})`);

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log(`Tracing terminated (${serviceName})`))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
}); 