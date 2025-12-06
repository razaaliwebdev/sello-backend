/**
 * Analytics Controller
 * Handles analytics tracking and reporting
 */

import Analytics from '../models/analyticsModel.js';
import { trackEvent, AnalyticsEvents } from '../utils/analytics.js';
import Logger from '../utils/logger.js';

/**
 * Track Event (Internal/Admin)
 */
export const trackAnalyticsEvent = async (req, res) => {
    try {
        const { event, metadata } = req.body;
        const userId = req.user?._id || null;

        if (!event) {
            return res.status(400).json({
                success: false,
                message: "Event type is required."
            });
        }

        // Track event
        await trackEvent(event, userId, {
            ...metadata,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        // Store in database
        await Analytics.create({
            event,
            userId,
            metadata: metadata || {},
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        return res.status(200).json({
            success: true,
            message: "Event tracked successfully."
        });
    } catch (error) {
        Logger.error('Track analytics event error', error);
        return res.status(500).json({
            success: false,
            message: "Server error tracking event."
        });
    }
};

/**
 * Get Analytics Summary (Admin)
 */
export const getAnalyticsSummary = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view analytics."
            });
        }

        const { startDate, endDate, eventType } = req.query;
        
        const query = {};
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }
        if (eventType) query.event = eventType;

        // Get event counts by type
        const eventCounts = await Analytics.aggregate([
            { $match: query },
            {
                $group: {
                    _id: "$event",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Get total events
        const totalEvents = await Analytics.countDocuments(query);

        // Get unique users
        const uniqueUsers = await Analytics.distinct("userId", query);

        // Get top events
        const topEvents = await Analytics.aggregate([
            { $match: query },
            {
                $group: {
                    _id: "$event",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        return res.status(200).json({
            success: true,
            message: "Analytics summary retrieved successfully.",
            data: {
                totalEvents,
                uniqueUsers: uniqueUsers.length,
                eventCounts,
                topEvents,
                dateRange: {
                    startDate: startDate || null,
                    endDate: endDate || null
                }
            }
        });
    } catch (error) {
        Logger.error('Get analytics summary error', error);
        return res.status(500).json({
            success: false,
            message: "Server error retrieving analytics."
        });
    }
};

export { AnalyticsEvents };
