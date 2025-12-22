/**
 * Redis Store for express-rate-limit
 * Custom store implementation using Redis client
 */

import redis from './redis.js';
import Logger from './logger.js';

/**
 * Custom Redis store for express-rate-limit
 */
export class RedisStore {
    constructor() {
        this.prefix = 'rl:'; // rate limit prefix
    }

    /**
     * Get value from Redis
     */
    async get(key) {
        if (!redis.isAvailable()) {
            return undefined;
        }

        try {
            const client = redis.getClient();
            if (!client) {
                return undefined;
            }

            const value = await client.get(`${this.prefix}${key}`);
            if (value === null) {
                return undefined;
            }

            const parsed = JSON.parse(value);
            return {
                totalHits: parsed.totalHits || 0,
                resetTime: parsed.resetTime || Date.now()
            };
        } catch (error) {
            Logger.error('Redis store GET error', error, { key });
            return undefined;
        }
    }

    /**
     * Set value in Redis
     */
    async set(key, value, options) {
        if (!redis.isAvailable()) {
            return;
        }

        try {
            const client = redis.getClient();
            if (!client) {
                return;
            }

            const ttl = options?.resetTime 
                ? Math.max(0, Math.ceil((options.resetTime - Date.now()) / 1000))
                : 900; // Default 15 minutes

            const data = {
                totalHits: value.totalHits || 0,
                resetTime: value.resetTime || Date.now()
            };

            await client.setEx(`${this.prefix}${key}`, ttl, JSON.stringify(data));
        } catch (error) {
            Logger.error('Redis store SET error', error, { key });
        }
    }

    /**
     * Increment value in Redis
     */
    async increment(key) {
        if (!redis.isAvailable()) {
            return {
                totalHits: 1,
                resetTime: Date.now() + 900000 // 15 minutes
            };
        }

        try {
            const client = redis.getClient();
            if (!client) {
                return {
                    totalHits: 1,
                    resetTime: Date.now() + 900000
                };
            }

            const redisKey = `${this.prefix}${key}`;
            const existing = await this.get(key);

            if (existing) {
                // Increment existing
                const newTotalHits = existing.totalHits + 1;
                const ttl = Math.max(0, Math.ceil((existing.resetTime - Date.now()) / 1000));
                
                await client.setEx(redisKey, ttl, JSON.stringify({
                    totalHits: newTotalHits,
                    resetTime: existing.resetTime
                }));

                return {
                    totalHits: newTotalHits,
                    resetTime: existing.resetTime
                };
            } else {
                // Create new
                const resetTime = Date.now() + 900000; // 15 minutes default
                await client.setEx(redisKey, 900, JSON.stringify({
                    totalHits: 1,
                    resetTime
                }));

                return {
                    totalHits: 1,
                    resetTime
                };
            }
        } catch (error) {
            Logger.error('Redis store INCREMENT error', error, { key });
            return {
                totalHits: 1,
                resetTime: Date.now() + 900000
            };
        }
    }

    /**
     * Decrement value in Redis
     */
    async decrement(key) {
        if (!redis.isAvailable()) {
            return;
        }

        try {
            const client = redis.getClient();
            if (!client) {
                return;
            }

            const existing = await this.get(key);
            if (existing && existing.totalHits > 0) {
                const newTotalHits = existing.totalHits - 1;
                const ttl = Math.max(0, Math.ceil((existing.resetTime - Date.now()) / 1000));
                
                await client.setEx(`${this.prefix}${key}`, ttl, JSON.stringify({
                    totalHits: newTotalHits,
                    resetTime: existing.resetTime
                }));
            }
        } catch (error) {
            Logger.error('Redis store DECREMENT error', error, { key });
        }
    }

    /**
     * Reset key in Redis
     */
    async resetKey(key) {
        if (!redis.isAvailable()) {
            return;
        }

        try {
            const client = redis.getClient();
            if (!client) {
                return;
            }

            await client.del(`${this.prefix}${key}`);
        } catch (error) {
            Logger.error('Redis store RESET error', error, { key });
        }
    }

    /**
     * Shutdown store
     */
    async shutdown() {
        // Redis connection is managed by redis.js utility
        // No need to close here
    }
}

export default RedisStore;

