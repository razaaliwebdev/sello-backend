/**
 * Caching Middleware
 * Caches API responses to improve performance
 */

import dbCache from "../utils/dbCache.js";
import Logger from "../utils/logger.js";

/**
 * Cache middleware factory
 * @param {number} ttl - Time to live in seconds (default: 3600 = 1 hour)
 * @param {function} keyGenerator - Function to generate cache key from request
 */
export const cache = (ttl = 3600, keyGenerator = null) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator
      ? keyGenerator(req)
      : `cache:${req.originalUrl || req.url}:${JSON.stringify(req.query)}`;

    try {
      // Try to get from cache
      const cachedData = await dbCache.get(cacheKey);
      if (cachedData) {
        // Set cache headers
        res.set("X-Cache", "HIT");
        return res.json(cachedData);
      }

      // Cache miss - continue to route handler
      // Override res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = function (data) {
        // Cache the response
        dbCache.set(cacheKey, data, ttl).catch((err) => {
          Logger.error("Cache set error", err, { cacheKey });
        });

        // Set cache headers
        res.set("X-Cache", "MISS");

        // Call original json method
        return originalJson(data);
      };

      next();
    } catch (error) {
      // If caching fails, continue without cache
      Logger.error("Cache middleware error", error, { cacheKey });
      next();
    }
  };
};

/**
 * Invalidate cache by pattern
 */
export const invalidateCache = async (pattern) => {
  if (dbCache.isAvailable()) {
    await dbCache.delPattern(pattern);
  }
};

/**
 * Cache key generators
 */
export const cacheKeys = {
  // Cache key for car listings
  carListings: (req) => {
    const { page = 1, limit = 10, ...filters } = req.query;
    return `cache:cars:list:${JSON.stringify({ page, limit, filters })}`;
  },

  // Cache key for single car
  car: (req) => {
    return `cache:cars:${req.params.id}`;
  },

  // Cache key for user profile
  userProfile: (req) => {
    return `cache:users:${req.params.id || req.user?._id}`;
  },

  // Cache key for categories
  categories: () => {
    return "cache:categories:all";
  },
};
