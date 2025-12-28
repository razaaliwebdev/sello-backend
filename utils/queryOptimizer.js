// Database query optimization utilities
import mongoose from "mongoose";

class QueryOptimizer {
  // Index definitions for common queries
  static indexes = {
    users: [
      { email: 1 }, // Unique index for email lookups
      { role: 1, createdAt: -1 }, // For admin user listings
      { verified: 1, createdAt: -1 }, // For user verification stats
    ],
    cars: [
      { make: 1, model: 1, year: -1 }, // For car search and filtering
      { price: 1, year: -1 }, // For price-based searches
      { city: 1, createdAt: -1 }, // For location-based searches
      { postedBy: 1, createdAt: -1 }, // For user listings
      { status: 1, createdAt: -1 }, // For admin moderation
      { tags: 1, createdAt: -1 }, // For tag-based searches
      { condition: 1, price: 1 }, // For condition + price filters
    ],
    blogs: [
      { slug: 1 }, // Unique index for blog slugs
      { status: 1, publishedAt: -1 }, // For published blogs
      { author: 1, publishedAt: -1 }, // For author blogs
      { tags: 1, publishedAt: -1 }, // For tag-based blog searches
      { category: 1, publishedAt: -1 }, // For category-based searches
    ],
    chats: [
      { participants: 1, updatedAt: -1 }, // For user chat lists
      { createdAt: -1 }, // For recent chats
    ],
    notifications: [
      { userId: 1, createdAt: -1 }, // For user notifications
      { type: 1, createdAt: -1 }, // For notification type analytics
      { read: 1, createdAt: -1 }, // For unread notifications
    ],
  };

  // Create indexes for all collections
  static async createIndexes() {
    const results = {};

    for (const [collectionName, indexDefinitions] of Object.entries(
      this.indexes
    )) {
      try {
        const Model = mongoose.model(collectionName);
        const indexResults = [];

        for (const indexDef of indexDefinitions) {
          const result = await Model.createIndexes([indexDef]);
          indexResults.push(result);
        }

        results[collectionName] = {
          success: true,
          indexesCreated: indexResults.length,
        };
      } catch (error) {
        results[collectionName] = {
          success: false,
          error: error.message,
        };
      }
    }

    return results;
  }

  // Optimized car search query
  static optimizedCarSearch(filters = {}) {
    const {
      make,
      model,
      year,
      minPrice,
      maxPrice,
      city,
      condition,
      tags,
      limit = 20,
      skip = 0,
      sortBy = "createdAt",
      sortOrder = -1,
    } = filters;

    // Build query with indexed fields first
    const query = {};

    // Use indexed fields for filtering
    if (make) query.make = make;
    if (model) query.model = model;
    if (year) query.year = parseInt(year);
    if (city) query.city = city;
    if (condition) query.condition = condition;

    // Price range query (uses compound index)
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Tags query (uses indexed array)
    if (tags && tags.length > 0) {
      query.tags = { $in: Array.isArray(tags) ? tags : [tags] };
    }

    // Build sort using indexed fields
    const sort = {};
    const validSortFields = ["createdAt", "price", "year", "make", "model"];

    if (validSortFields.includes(sortBy)) {
      sort[sortBy] = sortOrder;
    } else {
      sort.createdAt = -1; // Default sort
    }

    // Return optimized query
    return {
      query,
      options: {
        sort,
        limit: Math.min(parseInt(limit), 100), // Cap at 100 for performance
        skip: Math.max(parseInt(skip), 0),
        lean: true, // Return plain JavaScript objects for better performance
        select: this.getCarSelectFields(), // Only select needed fields
      },
    };
  }

  // Select only necessary fields for car listings
  static getCarSelectFields() {
    return {
      _id: 1,
      make: 1,
      model: 1,
      year: 1,
      price: 1,
      city: 1,
      condition: 1,
      images: 1,
      createdAt: 1,
      status: 1,
      postedBy: 1,
      // Exclude large fields like description, features, etc. for list views
    };
  }

  // Aggregation pipeline for analytics
  static getAnalyticsPipeline(timeRange = "30d") {
    const dateRange = this.getDateRange(timeRange);

    return [
      {
        $match: {
          createdAt: {
            $gte: dateRange.start,
            $lte: dateRange.end,
          },
          status: "approved",
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          totalCars: { $sum: 1 },
          avgPrice: { $avg: "$price" },
          totalValue: { $sum: "$price" },
          makes: { $addToSet: "$make" },
          cities: { $addToSet: "$city" },
        },
      },
      {
        $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 },
      },
    ];
  }

  // Get date range for analytics
  static getDateRange(timeRange) {
    const now = new Date();
    const start = new Date();

    switch (timeRange) {
      case "7d":
        start.setDate(now.getDate() - 7);
        break;
      case "30d":
        start.setDate(now.getDate() - 30);
        break;
      case "90d":
        start.setDate(now.getDate() - 90);
        break;
      case "1y":
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start.setDate(now.getDate() - 30);
    }

    return { start, end: now };
  }

  // Pagination helper with cursor-based pagination for large datasets
  static getCursorPagination(lastId, limit = 20) {
    const query = {};

    if (lastId) {
      query._id = { $gt: new mongoose.Types.ObjectId(lastId) };
    }

    return {
      query,
      options: {
        sort: { _id: 1 },
        limit: Math.min(parseInt(limit), 100),
        lean: true,
      },
    };
  }

  // Cache helper for frequently accessed data
  static getCacheKey(prefix, filters) {
    const sortedFilters = Object.keys(filters)
      .sort()
      .reduce((result, key) => {
        result[key] = filters[key];
        return result;
      }, {});

    return `${prefix}:${JSON.stringify(sortedFilters)}`;
  }

  // Query performance monitoring
  static async monitorQueryPerformance(queryFn, queryName) {
    const start = Date.now();

    try {
      const result = await queryFn();
      const duration = Date.now() - start;

      // Log slow queries (over 100ms)
      if (duration > 100) {
        console.warn(`Slow query detected: ${queryName} took ${duration}ms`);
      }

      return {
        data: result,
        performance: {
          duration,
          queryName,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`Query failed: ${queryName} after ${duration}ms`, error);
      throw error;
    }
  }
}

export default QueryOptimizer;
