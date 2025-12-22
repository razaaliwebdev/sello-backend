/**
 * Environment Variable Validator
 * Validates required and optional environment variables at startup
 */

import Logger from './logger.js';

/**
 * Environment variable configuration
 */
const ENV_CONFIG = {
    required: {
        // Critical - application won't work without these
        JWT_SECRET: {
            description: 'Secret key for JWT token signing',
            errorMessage: 'JWT authentication will fail without this'
        }
    },
    optional: {
        // Recommended but not required
        MONGO_URI: {
            description: 'MongoDB connection string',
            default: 'mongodb://127.0.0.1:27017/sello-db',
            warning: 'Using default MongoDB URI'
        },
        PORT: {
            description: 'Server port',
            default: '4000',
            warning: 'Using default port 4000'
        },
        CLIENT_URL: {
            description: 'Frontend URL for CORS',
            default: 'http://localhost:5173',
            warning: 'Using default CLIENT_URL'
        },
        // Email configuration
        SMTP_HOST: {
            description: 'SMTP server host',
            warning: 'Email functionality will be disabled'
        },
        SMTP_PORT: {
            description: 'SMTP server port',
            warning: 'Email functionality will be disabled'
        },
        SMTP_MAIL: {
            description: 'SMTP email address',
            warning: 'Email functionality will be disabled'
        },
        SMTP_PASSWORD: {
            description: 'SMTP password',
            warning: 'Email functionality will be disabled'
        },
        // Payment
        PAYMENT_GATEWAY: {
            description: 'Payment gateway selection (stripe, payfast, jazzcash)',
            default: 'stripe',
            warning: 'Using default payment gateway: stripe'
        },
        STRIPE_SECRET_KEY: {
            description: 'Stripe secret key',
            warning: 'Stripe payment functionality will be disabled'
        },
        STRIPE_WEBHOOK_SECRET: {
            description: 'Stripe webhook secret',
            warning: 'Stripe webhooks will not be verified'
        },
        JAZZCASH_MERCHANT_ID: {
            description: 'JazzCash merchant ID',
            warning: 'JazzCash payment functionality will be disabled'
        },
        JAZZCASH_PASSWORD: {
            description: 'JazzCash password',
            warning: 'JazzCash payment functionality will be disabled'
        },
        TWILIO_ACCOUNT_SID: {
            description: 'Twilio account SID for SMS',
            warning: 'SMS verification will be disabled'
        },
        TWILIO_AUTH_TOKEN: {
            description: 'Twilio auth token',
            warning: 'SMS verification will be disabled'
        },
        TWILIO_PHONE_NUMBER: {
            description: 'Twilio phone number',
            warning: 'SMS verification will be disabled'
        },
        // Google OAuth
        GOOGLE_CLIENT_ID: {
            description: 'Google OAuth client ID',
            warning: 'Google login will not work'
        },
        // Other
        NODE_ENV: {
            description: 'Environment mode',
            default: 'development',
            warning: 'Using development mode'
        }
    }
};

/**
 * Validate environment variables
 * @param {Object} options - Validation options
 * @param {boolean} options.strict - If true, exit process on missing required vars (default: true in production)
 * @returns {Object} Validation result
 */
export const validateEnvVars = (options = {}) => {
    const { strict = process.env.NODE_ENV === 'production' } = options;
    const missing = [];
    const warnings = [];
    const results = {
        valid: true,
        missing: [],
        warnings: [],
        summary: {}
    };

    // Check required variables
    for (const [varName, config] of Object.entries(ENV_CONFIG.required)) {
        if (!process.env[varName]) {
            missing.push({
                name: varName,
                description: config.description,
                errorMessage: config.errorMessage || `${varName} is required`
            });
            results.missing.push(varName);
        }
    }

    // Check optional variables
    for (const [varName, config] of Object.entries(ENV_CONFIG.optional)) {
        if (!process.env[varName]) {
            if (config.default) {
                warnings.push({
                    name: varName,
                    description: config.description,
                    message: config.warning || `Using default: ${config.default}`,
                    default: config.default
                });
            } else if (config.warning) {
                warnings.push({
                    name: varName,
                    description: config.description,
                    message: config.warning
                });
            }
            results.warnings.push(varName);
        }
    }

    // Log missing required variables
    if (missing.length > 0) {
        results.valid = false;
        const errorMsg = `Missing required environment variables: ${missing.map(m => m.name).join(', ')}`;
        
        missing.forEach(({ name, description, errorMessage }) => {
            Logger.error(`Missing required env var: ${name}`, null, {
                description,
                errorMessage
            });
            console.error(`❌ ${name}: ${description}`);
            console.error(`   ${errorMessage}`);
        });

        if (strict) {
            console.error('\n⚠️  Application cannot start without required environment variables.');
            console.error('Please set these variables in your .env file or environment.\n');
            process.exit(1);
        }
    }

    // Log warnings for optional variables
    if (warnings.length > 0) {
        warnings.forEach(({ name, description, message, default: defaultValue }) => {
            Logger.warn(`Optional env var not set: ${name}`, {
                description,
                message,
                default: defaultValue
            });
            console.warn(`⚠️  ${name}: ${description}`);
            console.warn(`   ${message}`);
            if (defaultValue) {
                console.warn(`   Using default: ${defaultValue}`);
            }
        });
    }

    // Create summary
    results.summary = {
        required: {
            total: Object.keys(ENV_CONFIG.required).length,
            set: Object.keys(ENV_CONFIG.required).length - missing.length,
            missing: missing.length
        },
        optional: {
            total: Object.keys(ENV_CONFIG.optional).length,
            set: Object.keys(ENV_CONFIG.optional).length - warnings.length,
            missing: warnings.length
        }
    };

    if (results.valid && warnings.length === 0) {
        Logger.info('Environment variables validated successfully', results.summary);
        console.log('✅ Environment variables validated successfully');
    }

    return results;
};

/**
 * Get environment variable with validation
 * @param {string} varName - Variable name
 * @param {string} defaultValue - Default value if not set
 * @param {boolean} required - Whether variable is required
 * @returns {string} Environment variable value
 */
export const getEnvVar = (varName, defaultValue = undefined, required = false) => {
    const value = process.env[varName];

    if (!value) {
        if (required) {
            const error = new Error(`Required environment variable ${varName} is not set`);
            Logger.error(`Required env var missing: ${varName}`, error);
            throw error;
        }
        return defaultValue;
    }

    return value;
};

export default validateEnvVars;

