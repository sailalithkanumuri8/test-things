# Loki-to-Jaeger Integration

This integration service automatically fetches logs from Loki and creates corresponding traces in Jaeger, allowing you to view all your IoT Thing actions and operations in a unified tracing interface.

## Architecture Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Things    │───▶│    Loki     │───▶│ Integration │───▶│   Jaeger    │
│  (Logging)  │    │  (Storage)  │    │  Service    │    │  (Tracing)  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Components

1. **Things**: IoT devices that send structured logs to Loki using winston-loki
2. **Loki**: Log aggregation system that stores all Thing logs
3. **Integration Service**: Polls Loki for new logs and creates traces in Jaeger
4. **Jaeger**: Distributed tracing system where you can view all Thing operations

## What You'll See in Jaeger

The integration service creates **traces** that represent sequences of actions performed by your Things:

- **Service Names**: Each Thing appears as a separate service (e.g., `http-express-calculator-simple`)
- **Span Names**: Operations like `property:result:updateProperty` or `action:add:invokeaction`
- **Span Events**: Individual log entries with detailed information
- **Span Attributes**: Thing metadata, operation types, and values

### Example Trace Structure

```
Service: http-express-calculator-simple
├── Span: property:result:updateProperty (2.3s)
│   ├── Event: Property update (result = 42)
│   ├── Event: Last change timestamp updated
│   └── Attributes: thing.name, thing.affordance, etc.
├── Span: action:add:invokeaction (0.5s)
│   ├── Event: Action invoked with input: 5
│   └── Event: Result calculated: 47
```

## Setup Instructions

### Prerequisites

1. Infrastructure services running (Loki, Jaeger)
2. Docker and Docker Compose installed
3. Things network created: `docker network create things_network`

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Set Environment Variables

Create a `.env` file with:

```env
# Loki Configuration
LOKI_HOSTNAME=localhost
LOKI_PORT=3100

# Jaeger Configuration  
JAEGER_OTLP_ENDPOINT=http://localhost:4318

# Integration Service Configuration
POLLING_INTERVAL=10000
```

### Step 3: Start Infrastructure Services

If you don't have them running yet:

```bash
# Start your infrastructure services (Loki, Jaeger, etc.)
docker-compose -f docker-compose-infrastructure.yml up -d
```

### Step 4: Start Things and Integration Service

```bash
# Start all Things and the integration service
docker-compose -f docker-compose-things.yml up -d
```

### Step 5: Verify Setup

1. **Check Loki**: Visit `http://localhost:3100` (if exposed)
2. **Check Jaeger**: Visit `http://localhost:16686`
3. **Check Integration Logs**: `docker-compose logs loki-jaeger-integration`

## Using the System

### 1. Interact with Things

Use your Things as normal. For example, with the calculator:

```bash
# Read a property
curl http://localhost/http-express-calculator-simple/properties/result

# Invoke an action
curl -X POST http://localhost/http-express-calculator-simple/actions/add \
  -H "Content-Type: application/json" \
  -d '{"input": 5}'
```

### 2. View Traces in Jaeger

1. Open Jaeger UI: `http://localhost:16686`
2. Select a service from the dropdown (e.g., `http-express-calculator-simple`)
3. Click "Find Traces"
4. Click on any trace to see detailed information

### 3. Understanding Trace Data

Each trace shows:

- **Duration**: How long the operation took
- **Spans**: Individual operations or grouped operations
- **Tags**: Metadata about the operation
- **Logs**: The actual log entries from Loki
- **Process**: Information about the Thing that generated the trace

## Log-to-Trace Mapping

The integration service converts Loki logs to Jaeger traces using these rules:

### Span Creation

- **Time Windows**: Logs within 5 seconds are grouped into a single span
- **Operation Types**: Different span types for properties, actions, and events
- **Service Names**: Each Thing becomes a separate service

### Span Attributes

| Loki Log Field | Jaeger Span Attribute | Description |
|---|---|---|
| `labels.thing` | `thing.name` | Name of the Thing |
| `labels.affordance` | `thing.affordance` | Type (property/action/event) |
| `labels.affordanceName` | `thing.affordanceName` | Specific name |
| `labels.op` | `thing.operation` | Operation type |
| `message` | `log.message` | Log message content |
| `level` | `log.level` | Log level |

### Span Events

Each log entry becomes a span event with:
- **Timestamp**: When the log was created
- **Name**: The log message
- **Attributes**: All the log metadata

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `LOKI_URL` | `http://localhost:3100` | Loki instance URL |
| `JAEGER_OTLP_ENDPOINT` | `http://localhost:4318` | Jaeger OTLP endpoint |
| `POLLING_INTERVAL` | `10000` | How often to poll Loki (ms) |

### Customization

The integration service can be customized by editing:

- `loki-jaeger-integration/index.js`: Main logic
- `groupOperationsByTimeWindow()`: Change time window for grouping
- `createSpanName()`: Customize span naming
- `getSpanAttributes()`: Add custom attributes

## Troubleshooting

### Common Issues

1. **No traces appearing**:
   - Check that Things are sending logs to Loki
   - Verify Loki is accessible from the integration service
   - Check integration service logs for errors

2. **Integration service not starting**:
   - Ensure all dependencies are installed
   - Check environment variables are set correctly
   - Verify Docker network connectivity

3. **Partial traces**:
   - Check Loki log format matches expected structure
   - Verify log timestamps are correct
   - Increase polling interval if needed

### Debug Commands

```bash
# Check integration service logs
docker-compose logs -f loki-jaeger-integration

# Test Loki connectivity
curl "http://localhost:3100/loki/api/v1/labels"

# Test Jaeger connectivity  
curl "http://localhost:16686/api/services"

# Check Things logs
docker-compose logs http-express-calculator-simple
```

## Advanced Usage

### Custom Queries

The integration service uses this Loki query:
```
{thing=~".+"} | json
```

You can modify this in `index.js` to:
- Filter specific Things: `{thing="calculator"}`
- Filter by log level: `{thing=~".+"} | json | level="info"`
- Add time ranges: Add `start` and `end` parameters

### Performance Tuning

- **Polling Interval**: Reduce for real-time traces, increase for lower load
- **Batch Size**: Modify the `limit` parameter in Loki queries
- **Time Windows**: Adjust `groupOperationsByTimeWindow()` for different granularity

### Extending the Integration

To add custom trace attributes:

1. Modify `getSpanAttributes()` in `index.js`
2. Add custom parsing in `parseLogEntry()`
3. Update span creation logic in `createTraceSpan()`

## Monitoring

The integration service includes:

- **Health Checks**: Logs successful processing
- **Error Handling**: Graceful error recovery
- **Memory Management**: Automatic cleanup of processed entries
- **Graceful Shutdown**: Proper cleanup on termination

Monitor the service health by checking:
- Docker container status
- Application logs
- Jaeger trace volume
- Loki query success rate

## Next Steps

1. **Add Alerting**: Set up alerts for integration failures
2. **Add Metrics**: Export Prometheus metrics for monitoring
3. **Add Filtering**: Allow filtering specific Things or operations
4. **Add Correlation**: Correlate with other observability data
5. **Add Real-time**: Consider WebSocket-based real-time updates 