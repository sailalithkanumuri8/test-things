const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { trace } = require('@opentelemetry/api');

const sdk = new NodeSDK({
  serviceName: 'otel-test',
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
console.log('OpenTelemetry tracing initialized (otel-test)');
const tracer = trace.getTracer('otel-test');
const span = tracer.startSpan('test-span');
setTimeout(() => {
  span.end();
  sdk.shutdown().then(() => {
    console.log('Tracing terminated (otel-test)');
    process.exit(0);
  });
}, 1000); 