#!/usr/bin/env node
/**
 * Inject environment variables into static game files
 * This script runs before build to replace placeholder tokens
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local if exists (for local development)
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) return;

        const equalIndex = trimmedLine.indexOf('=');
        if (equalIndex === -1) return;

        const key = trimmedLine.substring(0, equalIndex).trim();
        let value = trimmedLine.substring(equalIndex + 1).trim();

        // Remove surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        // Remove escaped newlines
        value = value.replace(/\\n/g, '').trim();

        if (key && value) {
            process.env[key] = value;
        }
    });
}

// Get token from environment (Vercel sets this directly)
let CESIUM_TOKEN = process.env.CESIUM_TOKEN;

if (!CESIUM_TOKEN) {
    console.error('ERROR: CESIUM_TOKEN environment variable is not set');
    console.error('Please set CESIUM_TOKEN in .env.local or as environment variable');
    process.exit(1);
}

// Clean token value (remove quotes, newlines, extra whitespace)
CESIUM_TOKEN = CESIUM_TOKEN
    .replace(/^["']|["']$/g, '')  // Remove surrounding quotes
    .replace(/\\n/g, '')          // Remove escaped newlines
    .replace(/\n/g, '')           // Remove actual newlines
    .trim();

console.log('CESIUM_TOKEN found:', CESIUM_TOKEN.substring(0, 20) + '...');

// Files to update
const gameJsPath = path.join(__dirname, '..', 'public', 'flight-game', 'game.js');

console.log('Injecting environment variables...');

if (fs.existsSync(gameJsPath)) {
    let content = fs.readFileSync(gameJsPath, 'utf8');

    // Replace placeholder or existing token
    const newContent = content.replace(
        /Cesium\.Ion\.defaultAccessToken\s*=\s*['"][^'"]*['"]/,
        `Cesium.Ion.defaultAccessToken = '${CESIUM_TOKEN}'`
    );

    if (newContent !== content) {
        fs.writeFileSync(gameJsPath, newContent, 'utf8');
        console.log('✓ Updated: game.js');
    } else {
        console.log('⚠ No changes made to game.js (pattern not found or already updated)');
    }
} else {
    console.log('⚠ File not found: game.js');
}

console.log('Environment injection complete!');
