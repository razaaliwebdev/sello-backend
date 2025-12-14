import SavedSearch from '../models/savedSearchModel.js';
import Car from '../models/carModel.js';
import User from '../models/userModel.js';
import { buildCarQuery } from '../utils/parseArray.js';
import Logger from '../utils/logger.js';
import sendEmail from '../utils/sendEmail.js';

/**
 * Create a saved search
 */
export const createSavedSearch = async (req, res) => {
    try {
        const { name, searchCriteria, emailAlerts = true, alertFrequency = 'daily' } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Search name is required'
            });
        }

        if (!searchCriteria || typeof searchCriteria !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Search criteria is required'
            });
        }

        // Validate alert frequency
        if (!['instant', 'daily', 'weekly'].includes(alertFrequency)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid alert frequency. Must be instant, daily, or weekly'
            });
        }

        // Check if user already has a search with same name
        const existingSearch = await SavedSearch.findOne({
            user: req.user._id,
            name: name.trim(),
            isActive: true
        });

        if (existingSearch) {
            return res.status(409).json({
                success: false,
                message: 'A saved search with this name already exists'
            });
        }

        const savedSearch = await SavedSearch.create({
            user: req.user._id,
            name: name.trim(),
            searchCriteria,
            emailAlerts,
            alertFrequency,
            isActive: true
        });

        Logger.info(`User ${req.user._id} created saved search`, { searchId: savedSearch._id });

        return res.status(201).json({
            success: true,
            message: 'Search saved successfully',
            data: savedSearch
        });
    } catch (error) {
        Logger.error('Error creating saved search', error, { userId: req.user?._id });
        return res.status(500).json({
            success: false,
            message: 'Error saving search',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get user's saved searches
 */
export const getSavedSearches = async (req, res) => {
    try {
        const savedSearches = await SavedSearch.find({
            user: req.user._id,
            isActive: true
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: savedSearches
        });
    } catch (error) {
        Logger.error('Error fetching saved searches', error, { userId: req.user?._id });
        return res.status(500).json({
            success: false,
            message: 'Error fetching saved searches'
        });
    }
};

/**
 * Get a single saved search
 */
export const getSavedSearch = async (req, res) => {
    try {
        const { searchId } = req.params;

        const savedSearch = await SavedSearch.findOne({
            _id: searchId,
            user: req.user._id
        });

        if (!savedSearch) {
            return res.status(404).json({
                success: false,
                message: 'Saved search not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: savedSearch
        });
    } catch (error) {
        Logger.error('Error fetching saved search', error, { userId: req.user?._id });
        return res.status(500).json({
            success: false,
            message: 'Error fetching saved search'
        });
    }
};

/**
 * Update a saved search
 */
export const updateSavedSearch = async (req, res) => {
    try {
        const { searchId } = req.params;
        const { name, searchCriteria, emailAlerts, alertFrequency, isActive } = req.body;

        const savedSearch = await SavedSearch.findOne({
            _id: searchId,
            user: req.user._id
        });

        if (!savedSearch) {
            return res.status(404).json({
                success: false,
                message: 'Saved search not found'
            });
        }

        // Update fields if provided
        if (name !== undefined) savedSearch.name = name.trim();
        if (searchCriteria !== undefined) savedSearch.searchCriteria = searchCriteria;
        if (emailAlerts !== undefined) savedSearch.emailAlerts = emailAlerts;
        if (alertFrequency !== undefined) {
            if (!['instant', 'daily', 'weekly'].includes(alertFrequency)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid alert frequency'
                });
            }
            savedSearch.alertFrequency = alertFrequency;
        }
        if (isActive !== undefined) savedSearch.isActive = isActive;

        await savedSearch.save();

        return res.status(200).json({
            success: true,
            message: 'Search updated successfully',
            data: savedSearch
        });
    } catch (error) {
        Logger.error('Error updating saved search', error, { userId: req.user?._id });
        return res.status(500).json({
            success: false,
            message: 'Error updating saved search'
        });
    }
};

/**
 * Delete a saved search
 */
export const deleteSavedSearch = async (req, res) => {
    try {
        const { searchId } = req.params;

        const savedSearch = await SavedSearch.findOne({
            _id: searchId,
            user: req.user._id
        });

        if (!savedSearch) {
            return res.status(404).json({
                success: false,
                message: 'Saved search not found'
            });
        }

        // Soft delete by setting isActive to false
        savedSearch.isActive = false;
        await savedSearch.save();

        Logger.info(`User ${req.user._id} deleted saved search`, { searchId });

        return res.status(200).json({
            success: true,
            message: 'Search deleted successfully'
        });
    } catch (error) {
        Logger.error('Error deleting saved search', error, { userId: req.user?._id });
        return res.status(500).json({
            success: false,
            message: 'Error deleting saved search'
        });
    }
};

/**
 * Execute a saved search and return results
 */
export const executeSavedSearch = async (req, res) => {
    try {
        const { searchId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        const savedSearch = await SavedSearch.findOne({
            _id: searchId,
            user: req.user._id,
            isActive: true
        });

        if (!savedSearch) {
            return res.status(404).json({
                success: false,
                message: 'Saved search not found'
            });
        }

        // Build query from saved criteria
        const queryResult = buildCarQuery(savedSearch.searchCriteria);
        const filter = queryResult.filter;

        // Add approval and visibility filters
        const approvalFilter = {
            $or: [
                { isApproved: true },
                { isApproved: { $exists: false } }
            ]
        };

        const now = new Date();
        const visibilityFilter = {
            status: { $ne: "deleted" },
            $or: [
                { status: { $ne: "sold" } },
                { autoDeleteDate: { $gt: now } },
                { autoDeleteDate: { $exists: false } }
            ]
        };

        const finalFilter = {
            $and: [
                filter,
                approvalFilter,
                visibilityFilter
            ]
        };

        // Execute search
        const [cars, total] = await Promise.all([
            Car.find(finalFilter)
                .sort({ featured: -1, isBoosted: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate({
                    path: "postedBy",
                    select: "name email role sellerRating reviewCount isVerified avatar dealerInfo"
                })
                .lean(),
            Car.countDocuments(finalFilter)
        ]);

        // Update last executed time
        savedSearch.lastExecutedAt = new Date();
        await savedSearch.save({ validateBeforeSave: false });

        return res.status(200).json({
            success: true,
            data: {
                cars,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                },
                searchCriteria: savedSearch.searchCriteria
            }
        });
    } catch (error) {
        Logger.error('Error executing saved search', error, { userId: req.user?._id });
        return res.status(500).json({
            success: false,
            message: 'Error executing saved search',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Send email alerts for saved searches (called by cron job)
 */
export const sendSavedSearchAlerts = async () => {
    try {
        const now = new Date();
        
        // Find searches that need alerts based on frequency
        const searchesNeedingAlerts = await SavedSearch.find({
            emailAlerts: true,
            isActive: true,
            $or: [
                { lastAlertSent: null },
                {
                    alertFrequency: 'instant',
                    lastAlertSent: { $lt: new Date(now.getTime() - 5 * 60 * 1000) } // 5 minutes ago
                },
                {
                    alertFrequency: 'daily',
                    lastAlertSent: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } // 24 hours ago
                },
                {
                    alertFrequency: 'weekly',
                    lastAlertSent: { $lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } // 7 days ago
                }
            ]
        }).populate('user', 'name email');

        Logger.info(`Processing ${searchesNeedingAlerts.length} saved searches for email alerts`);

        for (const search of searchesNeedingAlerts) {
            try {
                // Build query from saved criteria
                const queryResult = buildCarQuery(search.searchCriteria);
                const filter = queryResult.filter;

                // Add approval and visibility filters
                const approvalFilter = {
                    $or: [
                        { isApproved: true },
                        { isApproved: { $exists: false } }
                    ]
                };

                const visibilityFilter = {
                    status: { $nin: ["deleted", "sold"] } // Only active listings
                };

                const finalFilter = {
                    $and: [
                        filter,
                        approvalFilter,
                        visibilityFilter
                    ]
                };

                // Only get listings created since last alert
                if (search.lastAlertSent) {
                    finalFilter.$and.push({
                        createdAt: { $gt: search.lastAlertSent }
                    });
                } else {
                    // For first alert, get listings from last 7 days
                    finalFilter.$and.push({
                        createdAt: { $gt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
                    });
                }

                // Get new listings
                const newListings = await Car.find(finalFilter)
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .populate({
                        path: "postedBy",
                        select: "name email"
                    })
                    .lean();

                if (newListings.length > 0) {
                    // Send email alert
                    const user = await User.findById(search.user._id);
                    if (user && user.email) {
                        const searchUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/saved-searches/${search._id}`;
                        
                        const emailContent = `
                            <h2>New Listings Match Your Saved Search: ${search.name}</h2>
                            <p>We found ${newListings.length} new listing(s) that match your saved search criteria.</p>
                            <ul>
                                ${newListings.map(car => `
                                    <li>
                                        <strong>${car.title}</strong> - ${car.make} ${car.model} ${car.year}<br>
                                        Price: $${car.price.toLocaleString()}<br>
                                        <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/cars/${car._id}">View Listing</a>
                                    </li>
                                `).join('')}
                            </ul>
                            <p><a href="${searchUrl}">View All Results</a></p>
                            <p>To manage your saved searches, visit your profile settings.</p>
                        `;

                        await sendEmail({
                            to: user.email,
                            subject: `New Listings for: ${search.name}`,
                            html: emailContent
                        });

                        // Update search
                        search.lastAlertSent = new Date();
                        search.newListingsCount = newListings.length;
                        await search.save({ validateBeforeSave: false });

                        Logger.info(`Email alert sent for saved search ${search._id}`, {
                            userId: user._id,
                            listingsCount: newListings.length
                        });
                    }
                } else {
                    // No new listings, but update lastAlertSent to prevent checking too frequently
                    search.lastAlertSent = new Date();
                    await search.save({ validateBeforeSave: false });
                }
            } catch (searchError) {
                Logger.error(`Error processing saved search ${search._id}`, searchError);
                // Continue with next search
            }
        }

        return { processed: searchesNeedingAlerts.length };
    } catch (error) {
        Logger.error('Error sending saved search alerts', error);
        throw error;
    }
};
