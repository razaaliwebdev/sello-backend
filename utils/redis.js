/**
 * Redis Client Utility
 * Provides caching functionality for improved performance
 * Falls back gracefully if Redis is not available
 */

import Logger from './logger.js';

let redisClient = null;
let isRedisAvailable = false;

/**
 * Initialize Redis client
 */
async function initRedis() {
    if (process.env.REDIS_URL || process.env.REDIS_HOST) {
        try {
            const redis = await import('redis');
            
            const redisConfig = {
                socket: {
                    reconnectStrategy: (retries) => {
                        if (retries > 10) {
                            Logger.warn('Redis connection failed after 10 retries');
                            return new Error('Too many retries');
                        }
                        return Math.min(retries * 100, 3000);
                    }
                }
            };

            if (process.env.REDIS_URL) {
                redisClient = redis.createClient({ url: process.env.REDIS_URL, ...redisConfig });
            } else {
                redisClient = redis.createClient({
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT || '6379'),
                    password: process.env.REDIS_PASSWORD,
                    ...redisConfig
                });
            }

            redisClient.on('error', (err) => {
                Logger.error('Redis Client Error', err);
                isRedisAvailable = false;
            });

            redisClient.on('connect', () => {
                Logger.info('Redis Client Connected');
                isRedisAvailable = true;
            });

            redisClient.on('ready', () => {
                Logger.info('Redis Client Ready');
                isRedisAvailable = true;
            });

            redisClient.on('reconnecting', () => {
                Logger.warn('Redis Client Reconnecting');
            });

            await redisClient.connect();
            isRedisAvailable = true;
            Logger.info('Redis initialized successfully');
            
            return redisClient;
        } catch (error) {
            Logger.warn('Redis not available, continuing without cache', { error: error.message });
            isRedisAvailable = false;
            return null;
        }
    } else {
        Logger.warn('Redis not configured, continuing without cache');
        isRedisAvailable = false;
        return null;
    }
}

/**
 * Get Redis client instance
 */
function getClient() {
    return redisClient;
}

/**
 * Get value from cache
 */
async function get(key) {
    if (!isRedisAvailable || !redisClient) {
        return null;
    }

    try {
        const value = await redisClient.get(key);
        if (value === null) {
            return null;
        }
        try {
            return JSON.parse(value);
        } catch {
            // If not JSON, return as string
            return value;
        }
    } catch (error) {
        Logger.error('Redis GET error', error, { key });
        return null;
    }
}

/**
 * Set value in cache
 */
async function set(key, value, expirationSeconds = 3600) {
    if (!isRedisAvailable || !redisClient) {
        return false;
    }

    try {
        const stringValue = JSON.stringify(value);
        await redisClient.setEx(key, expirationSeconds, stringValue);
        return true;
    } catch (error) {
        Logger.error('Redis SET error', error, { key });
        return false;
    }
}

/**
 * Delete value from cache
 */
async function del(key) {
    if (!isRedisAvailable || !redisClient) {
        return false;
    }

    try {
        await redisClient.del(key);
        return true;
    } catch (error) {
        Logger.error('Redis DEL error', error, { key });
        return false;
    }
}

/**
 * Delete multiple keys matching pattern
 */
async function delPattern(pattern) {
    if (!isRedisAvailable || !redisClient) {
        return false;
    }

    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
        }
        return true;
    } catch (error) {
        Logger.error('Redis DEL pattern error', error, { pattern });
        return false;
    }
}

/**
 * Check if key exists
 */
async function exists(key) {
    if (!isRedisAvailable || !redisClient) {
        return false;
    }

    try {
        const result = await redisClient.exists(key);
        return result === 1;
    } catch (error) {
        Logger.error('Redis EXISTS error', error, { key });
        return false;
    }
}

/**
 * Get TTL (time to live) of a key
 */
async function ttl(key) {
    if (!isRedisAvailable || !redisClient) {
        return -1;
    }

    try {
        return await redisClient.ttl(key);
    } catch (error) {
        Logger.error('Redis TTL error', error, { key });
        return -1;
    }
}

/**
 * Increment a counter
 */
async function incr(key) {
    if (!isRedisAvailable || !redisClient) {
        return null;
    }

    try {
        return await redisClient.incr(key);
    } catch (error) {
        Logger.error('Redis INCR error', error, { key });
        return null;
    }
}

/**
 * Close Redis connection
 */
async function close() {
    if (redisClient && isRedisAvailable) {
        try {
            await redisClient.quit();
            isRedisAvailable = false;
        } catch (error) {
            Logger.error('Redis close error', error);
        }
    }
}

// Initialize Redis on module load
if (process.env.NODE_ENV !== 'test') {
    initRedis().catch((error) => {
        Logger.error('Failed to initialize Redis', error);
    });
}

export default {
    init: initRedis,
    getClient,
    get,
    set,
    del,
    delPattern,
    exists,
    ttl,
    incr,
    close,
    isAvailable: () => isRedisAvailable
};

