/**
 * Database-based Cache Utility
 * Replaces Redis functionality with MongoDB storage
 */

import Logger from "./logger.js";

class DBCache {
  constructor() {
    this.cache = new Map(); // In-memory fallback
    this.model = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Dynamic import to avoid circular dependencies
      const { default: mongoose } = await import("mongoose");

      // Define cache schema if not exists
      if (!mongoose.models.Cache) {
        const cacheSchema = new mongoose.Schema({
          key: { type: String, required: true, unique: true },
          value: { type: mongoose.Schema.Types.Mixed, required: true },
          expiresAt: { type: Date, required: true },
          createdAt: { type: Date, default: Date.now },
        });

        // Index for automatic cleanup of expired documents
        cacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

        mongoose.model("Cache", cacheSchema);
      }

      this.model = mongoose.model("Cache");
      this.isInitialized = true;

      Logger.info("Database cache initialized");
    } catch (error) {
      Logger.error("Failed to initialize database cache", error);
      // Fallback to memory cache
      this.isInitialized = false;
    }
  }

  async get(key) {
    if (!this.isInitialized) {
      return this.cache.get(key);
    }

    try {
      const doc = await this.model.findOne({
        key,
        expiresAt: { $gt: new Date() },
      });
      return doc ? doc.value : null;
    } catch (error) {
      Logger.error("Cache GET error", error, { key });
      return null;
    }
  }

  async set(key, value, expirationSeconds = 3600) {
    const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

    if (!this.isInitialized) {
      this.cache.set(key, value);
      // Simple memory expiration
      setTimeout(() => this.cache.delete(key), expirationSeconds * 1000);
      return true;
    }

    try {
      await this.model.findOneAndUpdate(
        { key },
        { value, expiresAt },
        { upsert: true, new: true }
      );
      return true;
    } catch (error) {
      Logger.error("Cache SET error", error, { key });
      return false;
    }
  }

  async del(key) {
    if (!this.isInitialized) {
      return this.cache.delete(key);
    }

    try {
      const result = await this.model.deleteOne({ key });
      return result.deletedCount > 0;
    } catch (error) {
      Logger.error("Cache DEL error", error, { key });
      return false;
    }
  }

  async delPattern(pattern) {
    if (!this.isInitialized) {
      // Simple pattern matching for memory cache
      const regex = new RegExp(pattern.replace(/\*/g, ".*"));
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this.cache.delete(key);
        }
      }
      return true;
    }

    try {
      const regex = new RegExp(pattern.replace(/\*/g, ".*"));
      const result = await this.model.deleteMany({ key: { $regex: regex } });
      return result.deletedCount > 0;
    } catch (error) {
      Logger.error("Cache DEL pattern error", error, { pattern });
      return false;
    }
  }

  async exists(key) {
    if (!this.isInitialized) {
      return this.cache.has(key);
    }

    try {
      const doc = await this.model.findOne({
        key,
        expiresAt: { $gt: new Date() },
      });
      return !!doc;
    } catch (error) {
      Logger.error("Cache EXISTS error", error, { key });
      return false;
    }
  }

  async ttl(key) {
    if (!this.isInitialized) {
      return -1; // Not supported in memory cache
    }

    try {
      const doc = await this.model.findOne({
        key,
        expiresAt: { $gt: new Date() },
      });
      if (!doc) return -1;

      const ttl = Math.floor((doc.expiresAt - new Date()) / 1000);
      return Math.max(0, ttl);
    } catch (error) {
      Logger.error("Cache TTL error", error, { key });
      return -1;
    }
  }

  async incr(key) {
    if (!this.isInitialized) {
      const current = this.cache.get(key) || 0;
      const newValue = current + 1;
      this.cache.set(key, newValue);
      return newValue;
    }

    try {
      const doc = await this.model.findOne({
        key,
        expiresAt: { $gt: new Date() },
      });
      const currentValue = doc ? doc.value || 0 : 0;
      const newValue = currentValue + 1;

      await this.model.findOneAndUpdate(
        { key },
        {
          value: newValue,
          expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour default
        },
        { upsert: true, new: true }
      );

      return newValue;
    } catch (error) {
      Logger.error("Cache INCR error", error, { key });
      return null;
    }
  }

  isAvailable() {
    return this.isInitialized;
  }

  async close() {
    if (this.isInitialized) {
      // MongoDB connection is managed by mongoose, no need to close here
    }
    this.cache.clear();
  }
}

// Create singleton instance
const dbCache = new DBCache();

// Initialize on module load
if (process.env.NODE_ENV !== "test") {
  dbCache.initialize().catch((error) => {
    Logger.error("Failed to initialize database cache", error);
  });
}

export default dbCache;
