#!/usr/bin/env node

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
 * Migration Script: Loki → OpenTelemetry Tracing
 * 
 * This script automatically converts all existing things from Loki logging
 * to OpenTelemetry tracing using the simple pattern.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const THINGS_DIR = path.join(__dirname, '..', 'things');
const TRACING_UTIL_PATH = path.join(__dirname, '..', 'util', 'tracing.js');

// Patterns to replace
const PATTERNS = {
    // Require statements
    winstonRequire: /const\s*{\s*createLogger,\s*transports,\s*format\s*}\s*=\s*require\("winston"\);\s*const\s*LokiTransport\s*=\s*require\("winston-loki"\);/g,
    
    // Logger creation
    loggerCreation: /const\s+logger\s*=\s*createLogger\(\{\s*transports:\s*\[\s*new\s+LokiTransport\(\{[^}]*\}\),\s*new\s+transports\.Console\(\{[^}]*\}\)\s*\]\s*\}\);/g,
    
    // logger.info calls
    loggerInfo: /logger\.info\(\{\s*message:\s*([^,]+),\s*labels:\s*\{([^}]*)\}\s*\}\);/g,
    
    // Simple logger.info calls
    simpleLoggerInfo: /logger\.info\(([^)]+)\);/g
};

// Replacement templates
const REPLACEMENTS = {
    // Add tracing require
    tracingRequire: `const { initTracing, trace, traceAsyncOperation } = require("${path.relative(THINGS_DIR, TRACING_UTIL_PATH).replace(/\\/g, '/')}");`,
    
    // Replace logger creation with tracing init
    tracingInit: (thingName) => `initTracing("${thingName}");`,
    
    // Replace logger.info with trace
    traceCall: (message, labels) => `trace(${message}, {${labels}});`,
    
    // Replace simple logger.info
    simpleTraceCall: (message) => `trace(${message});`
};

/**
 * Find all JavaScript files in the things directory
 */
function findThingFiles(dir) {
    const files = [];
    
    function scanDirectory(currentDir) {
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                scanDirectory(fullPath);
            } else if (item.endsWith('.js') && !item.includes('node_modules')) {
                files.push(fullPath);
            }
        }
    }
    
    scanDirectory(dir);
    return files;
}

/**
 * Check if a file uses Loki logging
 */
function usesLokiLogging(content) {
    return content.includes('winston-loki') || content.includes('createLogger');
}

/**
 * Extract thing name from file content
 */
function extractThingName(content) {
    const thingNameMatch = content.match(/const\s+thingName\s*=\s*["']([^"']+)["']/);
    return thingNameMatch ? thingNameMatch[1] : 'unknown-thing';
}

/**
 * Convert a file from Loki to OpenTelemetry tracing
 */
function convertFile(filePath) {
    console.log(`Converting: ${path.relative(THINGS_DIR, filePath)}`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Skip if no Loki logging
    if (!usesLokiLogging(content)) {
        console.log(`  Skipped: No Loki logging found`);
        return false;
    }
    
    // Extract thing name
    const thingName = extractThingName(content);
    
    // Replace require statements
    content = content.replace(PATTERNS.winstonRequire, REPLACEMENTS.tracingRequire);
    
    // Replace logger creation with tracing init
    content = content.replace(PATTERNS.loggerCreation, REPLACEMENTS.tracingInit(thingName));
    
    // Replace logger.info calls with trace calls
    content = content.replace(PATTERNS.loggerInfo, (match, message, labels) => {
        return REPLACEMENTS.traceCall(message, labels);
    });
    
    // Replace simple logger.info calls
    content = content.replace(PATTERNS.simpleLoggerInfo, (match, message) => {
        return REPLACEMENTS.simpleTraceCall(message);
    });
    
    // Write back to file
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  ✓ Converted successfully`);
        return true;
    } else {
        console.log(`  No changes needed`);
        return false;
    }
}

/**
 * Main migration function
 */
function migrateAllThings() {
    console.log('🚀 Starting migration from Loki to OpenTelemetry tracing...\n');
    
    const files = findThingFiles(THINGS_DIR);
    console.log(`Found ${files.length} JavaScript files in things directory\n`);
    
    let convertedCount = 0;
    let skippedCount = 0;
    
    for (const file of files) {
        try {
            const converted = convertFile(file);
            if (converted) {
                convertedCount++;
            } else {
                skippedCount++;
            }
        } catch (error) {
            console.error(`  ✗ Error converting ${path.relative(THINGS_DIR, file)}:`, error.message);
        }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`  ✓ Converted: ${convertedCount} files`);
    console.log(`  ⏭️  Skipped: ${skippedCount} files`);
    console.log(`  📁 Total: ${files.length} files`);
    
    if (convertedCount > 0) {
        console.log(`\n🎉 Migration completed! All things now use OpenTelemetry tracing.`);
        console.log(`\n📖 Next steps:`);
        console.log(`  1. Install tracing dependencies: cd util && npm install`);
        console.log(`  2. Start Jaeger: docker-compose -f docker-compose-tracing.yml up -d`);
        console.log(`  3. Run your things and view traces at http://localhost:16686`);
    } else {
        console.log(`\nℹ️  No files needed conversion.`);
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateAllThings();
}

module.exports = { migrateAllThings, convertFile }; 