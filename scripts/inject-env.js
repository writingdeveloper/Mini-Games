#!/usr/bin/env node
/**
 * Inject environment variables into static game files
 * This script runs before build to replace placeholder tokens
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local if exists
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && !key.startsWith('#')) {
            process.env[key.trim()] = valueParts.join('=').trim();
        }
    });
}

const CESIUM_TOKEN = process.env.CESIUM_TOKEN;

if (!CESIUM_TOKEN) {
    console.error('ERROR: CESIUM_TOKEN environment variable is not set');
    console.error('Please set CESIUM_TOKEN in .env.local or as environment variable');
    process.exit(1);
}

// Files to update
const filesToUpdate = [
    {
        path: path.join(__dirname, '..', 'public', 'flight-game', 'game.js'),
        pattern: /__CESIUM_TOKEN_PLACEHOLDER__|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9[^'"]*/g,
        replacement: CESIUM_TOKEN
    }
];

console.log('Injecting environment variables...');

filesToUpdate.forEach(({ path: filePath, pattern, replacement }) => {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (pattern.test(content)) {
            content = content.replace(pattern, replacement);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✓ Updated: ${path.basename(filePath)}`);
        } else {
            console.log(`⚠ Pattern not found in: ${path.basename(filePath)}`);
        }
    } else {
        console.log(`⚠ File not found: ${filePath}`);
    }
});

console.log('Environment injection complete!');
