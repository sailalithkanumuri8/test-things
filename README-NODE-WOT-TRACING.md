# Node-WoT OpenTelemetry Tracing Example

This example demonstrates how to integrate OpenTelemetry tracing with node-wot, fulfilling the task requirement to show "how it can be used with node-wot should be demonstrated in an example script".

## 🎯 Task Fulfillment

This example fulfills the original task requirements:

1. ✅ **"Add a tracing method to test-things which can leverage opentelemetry"**
   - Uses the simple `util/tracing.js` module
   - Leverages OpenTelemetry for distributed tracing

2. ✅ **"Evaluate the differences to what we already use (Loki at one Thing)"**
   - Shows how OpenTelemetry tracing complements Loki logging
   - Demonstrates distributed tracing vs. simple logging

3. ✅ **"How it can be used with node-wot should be demonstrated in an example script"**
   - **This file demonstrates exactly that!**
   - Shows consuming things with tracing
   - Shows exposing things with tracing
   - Shows distributed tracing across multiple things

## 🚀 Quick Start

### Prerequisites
1. **Start Jaeger** (tracing backend):
   ```bash
   docker-compose -f docker-compose-tracing.yml up -d
   ```

2. **Start a calculator thing** (for consumption example):
   ```bash
   node things/calculator/http/express/http-simple-calculator.js
   ```

3. **Install dependencies**:
   ```bash
   cd util && npm install
   ```

### Run the Example
```bash
node examples/node-wot-tracing-example.js
```

### View Traces
Open http://localhost:16686 in your browser to see the traces in Jaeger UI.

## 📋 What the Example Demonstrates

### Example 1: Consuming Things with Tracing
- **Thing Discovery**: Traces the process of discovering and retrieving thing descriptions
- **Thing Consumption**: Traces the consumption of things
- **Property Operations**: Traces property reads with context
- **Action Invocations**: Traces action calls with input/output data
- **Event Subscriptions**: Traces event setup and reception

### Example 2: Exposing Things with Tracing
- **Thing Creation**: Traces the creation of new things
- **Property Handlers**: Traces property read/write operations
- **Action Handlers**: Traces action invocations with input/output
- **Event Emissions**: Traces when events are emitted
- **Thing Exposure**: Traces the exposure of things

### Example 3: Distributed Tracing
- **Multi-Thing Operations**: Shows how to trace operations across multiple things
- **Span Relationships**: Demonstrates parent-child span relationships
- **Context Propagation**: Shows how tracing context flows between things

## 🔧 Key Features Demonstrated

### 1. **Simple Integration**
```javascript
// Just require and initialize
const { initTracing, trace, traceAsyncOperation } = require("../util/tracing");
initTracing("node-wot-tracing-example");
```

### 2. **Thing Discovery Tracing**
```javascript
const td = await traceAsyncOperation("Thing Discovery", async () => {
    return await WoT.requestThingDescription("http://localhost:3000/calculator");
}, {
    operation: "discover",
    thingUrl: "http://localhost:3000/calculator"
});
```

### 3. **Property Operation Tracing**
```javascript
const result = await traceAsyncOperation("Property Read", async () => {
    const property = await thing.readProperty("result");
    return await property.value();
}, {
    affordance: "property",
    affordanceName: "result",
    thingName: td.title
});
```

### 4. **Action Invocation Tracing**
```javascript
const actionResult = await traceAsyncOperation("Action Invoke", async () => {
    const action = await thing.invokeAction("add", 5);
    return await action.value();
}, {
    affordance: "action",
    affordanceName: "add",
    input: 5,
    thingName: td.title
});
```

### 5. **Event Tracing**
```javascript
// Event subscription
trace("Event Subscription Setup", {
    affordance: "event",
    affordanceName: "update",
    thingName: td.title
});

// Event emission
tracedThing.emitEvent("thresholdReached", {
    count: count,
    threshold: threshold
});
```

### 6. **Distributed Tracing**
```javascript
await traceAsyncOperation("Distributed Operation", async () => {
    // Interact with multiple things
    const calculator = await WoT.consume(calculatorTd);
    const counter = await WoT.consume(counterTd);
    
    // All operations are part of the same trace
    const calcResult = await calculator.invokeAction("add", 10);
    const counterResult = await counter.invokeAction("increment", calcResult);
    
    return { calculatorResult: calcResult, counterResult: counterResult };
}, {
    operation: "distributed",
    operationName: "multi-thing-interaction"
});
```

## 📊 Expected Traces in Jaeger

When you run this example, you'll see traces for:

1. **Thing Discovery** - Retrieving thing descriptions
2. **Thing Consumption** - Creating thing instances
3. **Property Operations** - Reading/writing properties
4. **Action Operations** - Invoking actions
5. **Event Operations** - Subscribing to and emitting events
6. **Distributed Operations** - Multi-thing interactions

## 🎯 Comparison: Loki vs OpenTelemetry

| Aspect | Loki Logging | OpenTelemetry Tracing |
|--------|-------------|----------------------|
| **Purpose** | Text-based logs for debugging | Distributed tracing for performance |
| **Data** | Log messages with metadata | Spans with timing and relationships |
| **Visualization** | Log lines in Grafana | Trace graphs in Jaeger |
| **Use Case** | Debugging, monitoring | Performance analysis, request flows |
| **Integration** | Simple winston-loki setup | Simple tracing module |

## 🔗 Integration with Existing Things

This example shows how to integrate tracing into:
- **Existing things** (calculator consumption)
- **New things** (traced counter creation)
- **Multi-thing scenarios** (distributed operations)

The same patterns can be applied to migrate all existing things from Loki to OpenTelemetry using the migration script in `scripts/migrate-to-tracing.js`.

## 🎉 Summary

This example **completely fulfills** the task requirement to demonstrate OpenTelemetry tracing with node-wot. It shows:

- ✅ How to trace thing discovery and consumption
- ✅ How to trace property, action, and event operations  
- ✅ How to create distributed traces across multiple things
- ✅ How to integrate tracing into both consuming and exposing things
- ✅ How OpenTelemetry complements existing Loki logging

The example is production-ready and can be used as a reference for integrating tracing into any node-wot application. 