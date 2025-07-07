/********************************************************************************
 * Copyright (c) 2024 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0, or the W3C Software Notice and
 * Document License (2015-05-13) which is available at
 * https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document.
 *
 * SPDX-License-Identifier: EPL-2.0 OR W3C-20150513
 ********************************************************************************/

/**
 * Node-WoT OpenTelemetry Tracing Example
 *
 * This example uses port and host values from the .env file for all Thing endpoints.
 *
 * Port mapping (from .env):
 *   - WEB_PORT_IN: HTTP Calculator Thing (default 80)
 *   - MODBUS_ELEVATOR_PORT_IN: Modbus Elevator Thing (default 3179)
 *   - COAP_SIMPLE_PORT_IN: CoAP Simple Thing (default 5683)
 *   - COAP_NEGOTITATION_PORT_IN: CoAP Negotiation Thing (default 5684)
 *   - SMART_HOME_SMART_CLOCK_PORT_IN: Smart Clock Thing (default 5685)
 *   - TRAEFIK_DASHBOARD_PORT_IN: Traefik Dashboard (default 8080)
 *
 * If a variable is not set, a sensible fallback is used.
 *
 * Make sure to load your .env file before running this script (e.g., with dotenv or by exporting vars).
 */

require('dotenv').config();
require('@node-wot/binding-http');

const { Servient } = require("@node-wot/core");
const { HttpServer } = require("@node-wot/binding-http");
const { HttpClientFactory } = require("@node-wot/binding-http");

// Import our simple tracing module
const { initTracing, traceMessage, traceAsyncOperation } = require("../util/tracing");

// Helper to get port from env or fallback
function getPort(envVar, fallback) {
    return process.env[envVar] || fallback;
}

// Helper to get host (assume localhost for dev)
function getHost() {
    return process.env.HOST || "localhost";
}

// Port assignments from .env
const CALCULATOR_PORT = getPort("WEB_PORT_IN", 80);
const COUNTER_PORT = getPort("SMART_HOME_SMART_CLOCK_PORT_IN", 5685); // Example for a counter thing
const EXPOSED_COUNTER_PORT = getPort("PORT", 8087);

// Thing URLs
const CALCULATOR_URL = "http://localhost/http-express-calculator-simple";
const EXPOSED_COUNTER_URL = `http://${getHost()}:${EXPOSED_COUNTER_PORT}/traced-counter`;

// Initialize tracing for this node-wot example
initTracing("node-wot-tracing-example");

async function main() {
    console.log("🚀 Starting Node-WoT OpenTelemetry Tracing Example...");
    console.log("📊 View traces at: http://localhost:16686\n");
    console.log(`ℹ️  Using Calculator Thing at: ${CALCULATOR_URL}`);
    console.log(`ℹ️  Exposing Counter Thing at: ${EXPOSED_COUNTER_URL}\n`);

    // Create servient with HTTP binding (side-effect import fallback, no port set in code)
    const servient = new Servient();
    servient.addClientFactory(new HttpClientFactory());

    try {
        const WoT = await servient.start();
        console.log(`✅ Servient started on port ${EXPOSED_COUNTER_PORT}`);

        // Example 1: Consume an existing thing with tracing
        await consumeThingWithTracing(WoT);

        // Example 2: Expose a new thing with tracing
        await exposeThingWithTracing(WoT);

        // Example 3: Demonstrate distributed tracing
        await demonstrateDistributedTracing(WoT);

        console.log("\n🎉 Examples completed successfully!");
        console.log("📊 Check Jaeger UI at http://localhost:16686 to see traces");
        console.log("⏹️  Press Ctrl+C to exit");

        // Keep the process running
        process.on('SIGINT', async () => {
            console.log("\n🛑 Shutting down...");
            await servient.shutdown();
            process.exit(0);
        });

    } catch (error) {
        console.error("❌ Error in main:", error);
        process.exit(1);
    }
}

/**
 * Example 1: Consume an existing thing with tracing
 */
async function consumeThingWithTracing(WoT) {
    console.log("\n=== Example 1: Consuming Thing with Tracing ===");

    try {
        // Trace thing discovery
        const td = await traceAsyncOperation("Thing Discovery", async () => {
            return await WoT.requestThingDescription(CALCULATOR_URL);
        }, {
            operation: "discover",
            thingUrl: CALCULATOR_URL
        });

        console.log("📋 Thing Description retrieved:", td.title);

        // Trace thing consumption
        const thing = await traceAsyncOperation("Thing Consumption", async () => {
            return await WoT.consume(td);
        }, {
            operation: "consume",
            thingName: td.title
        });

        console.log("✅ Thing consumed:", thing.getThingDescription().title);

        // Trace property read
        const result = await traceAsyncOperation("Property Read", async () => {
            const property = await thing.readProperty("result");
            return await property.value();
        }, {
            affordance: "property",
            affordanceName: "result",
            thingName: td.title
        });
        console.log("📊 Property 'result' read:", result);

        // Trace action invocation
        const actionResult = await traceAsyncOperation("Action Invoke", async () => {
            const action = await thing.invokeAction("add", 5);
            return await action.value();
        }, {
            affordance: "action",
            affordanceName: "add",
            input: 5,
            thingName: td.title
        });
        console.log("⚡ Action 'add' invoked with result:", actionResult);

        // Trace event subscription
        traceMessage("Event Subscription Setup", {
            affordance: "event",
            affordanceName: "update",
            thingName: td.title
        });

        thing.subscribeEvent("update", async (data) => {
            const eventData = await data.value();
            traceMessage("Event Received", {
                affordance: "event",
                affordanceName: "update",
                eventData: JSON.stringify(eventData),
                thingName: td.title
            });
            console.log("📡 Event 'update' received:", eventData);
        });

        console.log("📡 Event subscription set up");

    } catch (error) {
        console.error("❌ Error consuming thing:", error);
        throw error;
    }
}

/**
 * Example 2: Expose a new thing with tracing
 */
async function exposeThingWithTracing(WoT) {
    console.log("\n=== Example 2: Exposing Thing with Tracing ===");

    try {
        // Create a simple traced thing
        const tracedThing = await traceAsyncOperation("Thing Creation", async () => {
            return await WoT.produce({
                title: "traced-counter",
                description: "A simple counter with OpenTelemetry tracing",
                "@context": "https://www.w3.org/2022/wot/td/v1.1",
                properties: {
                    count: {
                        type: "integer",
                        description: "Current count value",
                        observable: true
                    }
                },
                actions: {
                    increment: {
                        description: "Increment the counter",
                        input: {
                            type: "integer",
                            description: "Amount to increment by"
                        },
                        output: {
                            type: "integer",
                            description: "New count value"
                        }
                    }
                },
                events: {
                    thresholdReached: {
                        description: "Emitted when count reaches a threshold",
                        data: {
                            type: "object",
                            properties: {
                                count: { type: "integer" },
                                threshold: { type: "integer" }
                            }
                        }
                    }
                }
            });
        }, {
            operation: "create",
            thingName: "traced-counter"
        });

        let count = 0;
        const threshold = 10;

        // Set up property handlers with tracing
        tracedThing.setPropertyReadHandler("count", async () => {
            return await traceAsyncOperation("Property Read Handler", async () => {
                console.log("📊 Property 'count' read:", count);
                return count;
            }, {
                affordance: "property",
                affordanceName: "count",
                thingName: "traced-counter",
                value: count
            });
        });

        tracedThing.setPropertyWriteHandler("count", async (value) => {
            const newValue = await value.value();
            return await traceAsyncOperation("Property Write Handler", async () => {
                count = newValue;
                console.log("✏️ Property 'count' written:", count);
                
                // Check threshold and emit event if needed
                if (count >= threshold) {
                    traceMessage("Threshold Event Emit", {
                        affordance: "event",
                        affordanceName: "thresholdReached",
                        thingName: "traced-counter",
                        count: count,
                        threshold: threshold
                    });
                    
                    tracedThing.emitEvent("thresholdReached", {
                        count: count,
                        threshold: threshold
                    });
                }
                
                return count;
            }, {
                affordance: "property",
                affordanceName: "count",
                thingName: "traced-counter",
                oldValue: count,
                newValue: newValue
            });
        });

        // Set up action handler with tracing
        tracedThing.setActionHandler("increment", async (input) => {
            const incrementValue = await input.value();
            return await traceAsyncOperation("Action Handler", async () => {
                count += incrementValue;
                console.log("⚡ Action 'increment' invoked with input:", incrementValue, "New count:", count);
                
                // Emit property change event
                tracedThing.emitPropertyChange("count");
                
                return count;
            }, {
                affordance: "action",
                affordanceName: "increment",
                thingName: "traced-counter",
                input: incrementValue,
                oldCount: count - incrementValue,
                newCount: count
            });
        });

        // Expose the thing with tracing
        await traceAsyncOperation("Thing Exposure", async () => {
            await tracedThing.expose();
        }, {
            operation: "expose",
            thingName: "traced-counter"
        });

        console.log(`✅ Traced counter thing exposed at ${EXPOSED_COUNTER_URL}`);

        // Demonstrate the traced thing
        await demonstrateTracedThing();

    } catch (error) {
        console.error("❌ Error exposing thing:", error);
        throw error;
    }
}

/**
 * Demonstrate the traced thing functionality
 */
async function demonstrateTracedThing() {
    console.log("\n=== Demonstrating Traced Thing ===");

    try {
        // Simulate some operations on the traced thing
        const servient = new Servient();
        servient.addClientFactory(new HttpClientFactory());
        const WoT = await servient.start();

        const td = await WoT.requestThingDescription(EXPOSED_COUNTER_URL);
        const thing = await WoT.consume(td);

        // Read initial count
        const initialCount = await thing.readProperty("count");
        console.log("📊 Initial count:", await initialCount.value());

        // Increment by 3
        const incrementResult = await thing.invokeAction("increment", 3);
        console.log("⚡ After increment(3):", await incrementResult.value());

        // Increment by 5
        const incrementResult2 = await thing.invokeAction("increment", 5);
        console.log("⚡ After increment(5):", await incrementResult2.value());

        // Subscribe to threshold event
        thing.subscribeEvent("thresholdReached", async (data) => {
            const eventData = await data.value();
            console.log("🎯 Threshold reached event:", eventData);
        });

        // Increment to trigger threshold event
        const incrementResult3 = await thing.invokeAction("increment", 5);
        console.log("⚡ After increment(5) - should trigger threshold:", await incrementResult3.value());

        await servient.shutdown();

    } catch (error) {
        console.error("❌ Error demonstrating traced thing:", error);
    }
}

/**
 * Example 3: Demonstrate distributed tracing
 */
async function demonstrateDistributedTracing(WoT) {
    console.log("\n=== Example 3: Distributed Tracing ===");

    try {
        // Create a span that represents a complex operation involving multiple things
        await traceAsyncOperation("Distributed Operation", async () => {
            // Simulate interaction with multiple things
            const calculatorTd = await WoT.requestThingDescription(CALCULATOR_URL);
            const calculator = await WoT.consume(calculatorTd);

            // Add tracing attributes to show this is part of a distributed operation
            traceMessage("Distributed Operation Step", {
                operation: "distributed",
                step: "calculator_interaction",
                sequence: "1"
            });

            // Perform calculator operations
            const calcResult = await calculator.invokeAction("add", 10);
            const finalResult = await calcResult.value();
            console.log("🧮 Calculator result in distributed operation:", finalResult);

            // Simulate interaction with traced counter
            const counterTd = await WoT.requestThingDescription(EXPOSED_COUNTER_URL);
            const counter = await WoT.consume(counterTd);

            traceMessage("Distributed Operation Step", {
                operation: "distributed",
                step: "counter_interaction",
                sequence: "2"
            });

            // Perform counter operations
            const counterResult = await counter.invokeAction("increment", finalResult);
            const counterFinal = await counterResult.value();
            console.log("🔢 Counter result in distributed operation:", counterFinal);

            // Add final result to the distributed operation span
            traceMessage("Distributed Operation Complete", {
                operation: "distributed",
                final_result: counterFinal.toString()
            });

            return {
                calculatorResult: finalResult,
                counterResult: counterFinal
            };
        }, {
            operation: "distributed",
            operationName: "multi-thing-interaction"
        });

        console.log("✅ Distributed tracing demonstration completed");

    } catch (error) {
        console.error("❌ Error in distributed tracing:", error);
        throw error;
    }
}

// Run the example
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    main,
    consumeThingWithTracing,
    exposeThingWithTracing,
    demonstrateDistributedTracing
}; 