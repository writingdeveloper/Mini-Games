#!/usr/bin/env node
/**
 * Restore placeholder tokens in static game files
 * Run this before committing to avoid exposing tokens
 */

const fs = require('fs');
const path = require('path');

const PLACEHOLDER = '__CESIUM_TOKEN_PLACEHOLDER__';

const filesToRestore = [
    {
        path: path.join(__dirname, '..', 'public', 'flight-game', 'game.js'),
        pattern: /Cesium\.Ion\.defaultAccessToken\s*=\s*'[^']+'/,
        replacement: `Cesium.Ion.defaultAccessToken = '${PLACEHOLDER}'`
    }
];

console.log('Restoring placeholder tokens...');

filesToRestore.forEach(({ path: filePath, pattern, replacement }) => {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (pattern.test(content)) {
            content = content.replace(pattern, replacement);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✓ Restored: ${path.basename(filePath)}`);
        } else {
            console.log(`⚠ Pattern not found in: ${path.basename(filePath)}`);
        }
    } else {
        console.log(`⚠ File not found: ${filePath}`);
    }
});

console.log('Placeholder restoration complete!');
