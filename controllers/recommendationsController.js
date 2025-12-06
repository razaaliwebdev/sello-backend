/**
 * Recommendations Controller
 * Provides similar listings and recommendations
 */

import Car from '../models/carModel.js';
import RecentlyViewed from '../models/recentlyViewedModel.js';
import mongoose from 'mongoose';
import Logger from '../utils/logger.js';

/**
 * Get Similar Listings
 */
export const getSimilarListings = async (req, res) => {
    try {
        const { carId } = req.params;
        const limit = parseInt(req.query.limit) || 6;

        if (!mongoose.Types.ObjectId.isValid(carId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid car ID."
            });
        }

        const car = await Car.findById(carId);
        if (!car) {
            return res.status(404).json({
                success: false,
                message: "Car not found."
            });
        }

        // Find similar cars based on make, model, bodyType, and price range
        const priceRange = car.price * 0.3; // 30% price range
        const similarCars = await Car.find({
            _id: { $ne: car._id },
            isApproved: true,
            status: { $ne: "deleted" },
            $or: [
                { 
                    make: car.make,
                    model: car.model,
                    price: { $gte: car.price - priceRange, $lte: car.price + priceRange }
                },
                {
                    make: car.make,
                    bodyType: car.bodyType,
                    price: { $gte: car.price - priceRange, $lte: car.price + priceRange }
                },
                {
                    bodyType: car.bodyType,
                    fuelType: car.fuelType,
                    price: { $gte: car.price - priceRange, $lte: car.price + priceRange }
                }
            ]
        })
        .populate("postedBy", "name email role sellerRating reviewCount isVerified")
        .limit(limit)
        .sort({ isBoosted: -1, boostPriority: -1, createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Similar listings retrieved successfully.",
            data: similarCars
        });
    } catch (error) {
        Logger.error('Get similar listings error', error);
        return res.status(500).json({
            success: false,
            message: "Server error retrieving similar listings."
        });
    }
};

/**
 * Track Recently Viewed
 */
export const trackRecentlyViewed = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
        }

        const { carId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(carId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid car ID."
            });
        }

        // Upsert: update if exists, create if not
        await RecentlyViewed.findOneAndUpdate(
            { user: req.user._id, car: carId },
            { viewedAt: new Date() },
            { upsert: true, new: true }
        );

        return res.status(200).json({
            success: true,
            message: "View tracked successfully."
        });
    } catch (error) {
        Logger.error('Track recently viewed error', error);
        // Don't fail the request if tracking fails
        return res.status(200).json({
            success: true,
            message: "View tracked successfully."
        });
    }
};

/**
 * Get Recently Viewed Listings
 */
export const getRecentlyViewed = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
        }

        const limit = parseInt(req.query.limit) || 10;

        const recentlyViewed = await RecentlyViewed.find({ user: req.user._id })
            .populate("car", "title make model year price images condition fuelType transmission mileage city")
            .sort({ viewedAt: -1 })
            .limit(limit);

        // Filter out deleted cars
        const validCars = recentlyViewed
            .filter(rv => rv.car && rv.car.status !== 'deleted')
            .map(rv => rv.car);

        return res.status(200).json({
            success: true,
            message: "Recently viewed listings retrieved successfully.",
            data: validCars
        });
    } catch (error) {
        Logger.error('Get recently viewed error', error);
        return res.status(500).json({
            success: false,
            message: "Server error retrieving recently viewed listings."
        });
    }
};

/**
 * Get Recommended Listings
 */
export const getRecommendedListings = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
        }

        const limit = parseInt(req.query.limit) || 6;

        // Get user's recently viewed cars
        const recentlyViewed = await RecentlyViewed.find({ user: req.user._id })
            .populate("car")
            .sort({ viewedAt: -1 })
            .limit(10);

        if (recentlyViewed.length === 0) {
            // If no history, return featured/boosted listings
            const recommended = await Car.find({
                isApproved: true,
                status: { $ne: "deleted" },
                $or: [
                    { featured: true },
                    { isBoosted: true }
                ]
            })
            .populate("postedBy", "name email role sellerRating reviewCount isVerified")
            .limit(limit)
            .sort({ featured: -1, isBoosted: -1, boostPriority: -1, createdAt: -1 });

            return res.status(200).json({
                success: true,
                message: "Recommended listings retrieved successfully.",
                data: recommended
            });
        }

        // Analyze viewing patterns
        const makes = {};
        const bodyTypes = {};
        const priceRanges = [];

        recentlyViewed.forEach(rv => {
            if (rv.car) {
                makes[rv.car.make] = (makes[rv.car.make] || 0) + 1;
                bodyTypes[rv.car.bodyType] = (bodyTypes[rv.car.bodyType] || 0) + 1;
                priceRanges.push(rv.car.price);
            }
        });

        const topMake = Object.keys(makes).sort((a, b) => makes[b] - makes[a])[0];
        const topBodyType = Object.keys(bodyTypes).sort((a, b) => bodyTypes[b] - bodyTypes[a])[0];
        const avgPrice = priceRanges.reduce((a, b) => a + b, 0) / priceRanges.length;
        const priceRange = avgPrice * 0.4; // 40% range

        // Find recommended cars based on preferences
        const recommended = await Car.find({
            _id: { $nin: recentlyViewed.map(rv => rv.car._id) },
            isApproved: true,
            status: { $ne: "deleted" },
            $or: [
                { make: topMake },
                { bodyType: topBodyType },
                { 
                    price: { 
                        $gte: avgPrice - priceRange, 
                        $lte: avgPrice + priceRange 
                    } 
                }
            ]
        })
        .populate("postedBy", "name email role sellerRating reviewCount isVerified")
        .limit(limit)
        .sort({ isBoosted: -1, boostPriority: -1, createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Recommended listings retrieved successfully.",
            data: recommended
        });
    } catch (error) {
        Logger.error('Get recommended listings error', error);
        return res.status(500).json({
            success: false,
            message: "Server error retrieving recommended listings."
        });
    }
};

