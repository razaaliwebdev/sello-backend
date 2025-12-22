/**
 * Environment Variable Validation Script
 * Validates all required environment variables are set before deployment
 * 
 * Usage: node server/scripts/validateEnv.js
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Required environment variables
const requiredVars = {
    // Critical - Application won't work without these
    critical: [
        'JWT_SECRET',
        'MONGO_URI',
    ],
    // Important - Features won't work without these
    important: [
        'CLIENT_URL',
        'FRONTEND_URL',
    ],
    // Optional but recommended for production
    recommended: [
        'GOOGLE_CLIENT_ID',
        'CLOUDINARY_CLOUD_NAME',
        'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET',
        'SMTP_HOST',
        'SMTP_MAIL',
    ]
};

// Check if variable is set and not empty
function isSet(varName) {
    const value = process.env[varName];
    return value !== undefined && value !== null && value.trim() !== '';
}

// Validate variables
function validateEnv() {
    const results = {
        critical: [],
        important: [],
        recommended: [],
        allValid: true
    };

    // Check critical variables
    requiredVars.critical.forEach(varName => {
        if (!isSet(varName)) {
            results.critical.push(varName);
            results.allValid = false;
        }
    });

    // Check important variables
    requiredVars.important.forEach(varName => {
        if (!isSet(varName)) {
            results.important.push(varName);
        }
    });

    // Check recommended variables
    requiredVars.recommended.forEach(varName => {
        if (!isSet(varName)) {
            results.recommended.push(varName);
        }
    });

    return results;
}

// Main execution
console.log('🔍 Validating Environment Variables...\n');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}\n`);

const results = validateEnv();

// Display results
if (results.critical.length > 0) {
    console.log('❌ CRITICAL - Missing Required Variables:');
    results.critical.forEach(varName => {
        console.log(`   - ${varName}`);
    });
    console.log('');
}

if (results.important.length > 0) {
    console.log('⚠️  IMPORTANT - Missing Recommended Variables:');
    results.important.forEach(varName => {
        console.log(`   - ${varName}`);
    });
    console.log('');
}

if (results.recommended.length > 0) {
    console.log('💡 RECOMMENDED - Missing Optional Variables:');
    results.recommended.forEach(varName => {
        console.log(`   - ${varName}`);
    });
    console.log('');
}

// Summary
if (results.allValid) {
    console.log('✅ All critical environment variables are set!');
    
    if (results.important.length === 0 && results.recommended.length === 0) {
        console.log('✅ All recommended variables are also set!');
        process.exit(0);
    } else {
        console.log('⚠️  Some recommended variables are missing, but application can run.');
        process.exit(0);
    }
} else {
    console.log('❌ CRITICAL ERROR: Missing required environment variables!');
    console.log('   Please set the missing variables before starting the application.\n');
    console.log('   See ENV_SETUP.md for details on how to set these variables.');
    process.exit(1);
}

