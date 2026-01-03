/**
 * Database Store for express-rate-limit
 * Custom store implementation using MongoDB instead of Redis
 */

import dbCache from "./dbCache.js";
import Logger from "./logger.js";

export class DBStore {
  constructor() {
    this.prefix = "rl:"; // rate limit prefix
  }

  /**
   * Get value from database cache
   */
  async get(key) {
    try {
      const value = await dbCache.get(`${this.prefix}${key}`);
      if (!value) {
        return undefined;
      }

      return {
        totalHits: value.totalHits || 0,
        resetTime: new Date(value.resetTime || Date.now()), // Ensure it's a Date object
      };
    } catch (error) {
      Logger.error("DB store GET error", error, { key });
      return undefined;
    }
  }

  /**
   * Set value in database cache
   */
  async set(key, value, options) {
    try {
      const resetTime = options?.resetTime || new Date(Date.now() + 900000); // 15 minutes default
      const ttl = options?.resetTime
        ? Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
        : 900; // Default 15 minutes

      const data = {
        totalHits: value.totalHits || 0,
        resetTime: resetTime,
      };

      await dbCache.set(`${this.prefix}${key}`, data, ttl);
    } catch (error) {
      Logger.error("DB store SET error", error, { key });
    }
  }

  /**
   * Increment value in database cache
   */
  async increment(key) {
    try {
      const existing = await this.get(key);

      if (existing) {
        // Increment existing
        const newTotalHits = existing.totalHits + 1;
        const resetTime = new Date(existing.resetTime); // Ensure it's a Date object
        const ttl = Math.max(
          0,
          Math.ceil((resetTime.getTime() - Date.now()) / 1000)
        );

        const data = {
          totalHits: newTotalHits,
          resetTime: resetTime,
        };

        await dbCache.set(`${this.prefix}${key}`, data, ttl);

        return {
          totalHits: newTotalHits,
          resetTime: resetTime,
        };
      } else {
        // Create new
        const resetTime = new Date(Date.now() + 900000); // 15 minutes default
        const data = {
          totalHits: 1,
          resetTime: resetTime,
        };

        await dbCache.set(`${this.prefix}${key}`, data, 900);

        return {
          totalHits: 1,
          resetTime: resetTime,
        };
      }
    } catch (error) {
      Logger.error("DB store INCREMENT error", error, { key });
      return {
        totalHits: 1,
        resetTime: new Date(Date.now() + 900000),
      };
    }
  }

  /**
   * Decrement value in database cache
   */
  async decrement(key) {
    try {
      const existing = await this.get(key);
      if (existing && existing.totalHits > 0) {
        const newTotalHits = existing.totalHits - 1;
        const resetTime = existing.resetTime; // Already a Date object from get()
        const ttl = Math.max(
          0,
          Math.ceil((resetTime.getTime() - Date.now()) / 1000)
        );

        const data = {
          totalHits: newTotalHits,
          resetTime: resetTime,
        };

        await dbCache.set(`${this.prefix}${key}`, data, ttl);
      }
    } catch (error) {
      Logger.error("DB store DECREMENT error", error, { key });
    }
  }

  /**
   * Reset key in database cache
   */
  async resetKey(key) {
    try {
      await dbCache.del(`${this.prefix}${key}`);
    } catch (error) {
      Logger.error("DB store RESET error", error, { key });
    }
  }

  /**
   * Shutdown store
   */
  async shutdown() {
    // Cache connection is managed by dbCache.js utility
    // No need to close here
  }
}

export default DBStore;
