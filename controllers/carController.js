import mongoose from "mongoose";
import Car from "../models/carModel.js";
import { uploadCloudinary } from '../utils/cloudinary.js'
import User from '../models/userModel.js';
import { parseArray, buildCarQuery } from '../utils/parseArray.js';



// CREATE CAR Controller
export const createCar = async (req, res) => {
    try {
        // Ensure user is authenticated
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: User not authenticated',
            });
        }

        // Extract fields from FormData
        const {
            title, description, make, model, variant, year, condition, price, colorExterior,
            colorInterior, fuelType, engineCapacity, transmission, mileage, features,
            regionalSpec, bodyType, city, location, sellerType, carDoors, contactNumber,
            geoLocation, horsepower, warranty, numberOfCylinders, ownerType,
        } = req.body;

        // Validate required fields
        const requiredFields = [
            'title', 'make', 'model', 'year', 'condition', 'price', 'fuelType',
            'engineCapacity', 'transmission', 'regionalSpec', 'bodyType', 'city',
            'contactNumber', 'sellerType', 'warranty', 'ownerType', 'geoLocation',
        ];
        const missing = requiredFields.filter((key) => !req.body[key] || req.body[key].toString().trim() === '');
        if (missing.length) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missing.join(', ')}`,
            });
        }

        // Validate contactNumber
        if (!/^\+?\d{9,15}$/.test(contactNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid contact number. Must be 9-15 digits.',
            });
        }

        // Parse geoLocation
        let parsedGeoLocation;
        try {
            parsedGeoLocation = JSON.parse(geoLocation);
            if (
                !Array.isArray(parsedGeoLocation) ||
                parsedGeoLocation.length !== 2 ||
                typeof parsedGeoLocation[0] !== 'number' ||
                typeof parsedGeoLocation[1] !== 'number' ||
                parsedGeoLocation[0] === 0 ||
                parsedGeoLocation[1] === 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid geoLocation format. Use [longitude, latitude] with non-zero values.',
                });
            }
        } catch {
            return res.status(400).json({
                success: false,
                message: 'Invalid geoLocation format. Must be a valid JSON array [longitude, latitude].',
            });
        }

        // Parse features
        const parsedFeatures = parseArray(features);

        // Handle images
        // Handle image uploads (Cloudinary with memoryStorage)
        let images = [];
        if (req.files && req.files.length > 0) {
            const uploadedImages = await Promise.all(
                req.files.map(async (file) => {
                    try {
                        const imageUrl = await uploadCloudinary(file.buffer);
                        return imageUrl;
                    } catch (err) {
                        console.error("Error uploading image:", err);
                        return null;
                    }
                })
            );

            // Remove any null values (failed uploads)
            images = uploadedImages.filter((url) => url);
        }


        // Create car document
        const carData = {
            title,
            description: description || '',
            make,
            model,
            variant: variant || 'N/A',
            year: parseInt(year),
            condition,
            price: parseFloat(price),
            colorExterior: colorExterior || 'N/A',
            colorInterior: colorInterior || 'N/A',
            fuelType,
            engineCapacity,
            transmission,
            mileage: parseInt(mileage) || 0,
            features: parsedFeatures,
            regionalSpec,
            bodyType,
            city,
            location: location || '',
            sellerType,
            carDoors: parseInt(carDoors) || 4,
            contactNumber,
            geoLocation: {
                type: 'Point',
                coordinates: parsedGeoLocation,
            },
            horsepower: horsepower || 'N/A',
            warranty,
            numberOfCylinders: parseInt(numberOfCylinders) || 4,
            ownerType,
            images,
            postedBy: req.user._id, // Set from authenticated user
        };

        // console.log('Car data before saving:', carData);

        const car = await Car.create(carData);
        await User.findByIdAndUpdate(req.user._id, {
            $push: { carsPosted: car._id }
        });

        return res.status(201).json({
            success: true,
            message: 'Car post created successfully',
            data: car,
        });
    } catch (error) {
        console.error('Error creating car:', error);
        return res.status(400).json({
            success: false,
            message: error.message.includes('validation failed')
                ? `Validation error: ${error.message}`
                : 'Failed to create car post',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

// Edit Car Controller
export const editCar = async (req, res) => {
    try {

        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid car ID"
            });
        };

        const car = await Car.findById(id);

        // Only owner or admin  can update
        if (car.postedBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
            return res.status(400).json({ message: "You are not authorized to update this car." })
        };

        const updatedCar = await Car.findByIdAndUpdate(id, req.body, { new: true });

        return res.status(200).json({
            updatedCar,
            message: "Car Updated Successfully."
        });

    } catch (error) {
        console.log("Update Car Error", error.message);
        res.status(500).json(
            {
                message: "Sever error while updating car",
                error: error.message
            }
        )
    }
};

// Delete Car Controller
export const deleteCar = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid Car ID"
            });
        };

        const car = await Car.findById(id);

        if (!car) {
            return res.status(400).json({ message: "Car not found." })
        };

        // Only owner or admin can delete
        if (car.postedBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
            return res.status(400).json({
                message: "You are not authorized to delete this car."
            })
        };

        await car.deleteOne();

        return res.status(200).json({
            message: "Car deleted successfully."
        });

    } catch (error) {
        console.log("Delete Car Error", error.message);
        return res.status(500).json(
            {
                message: "Server error while deleting car.",
                error: error.message
            }
        )
    }
};

// GetMyCars (My Listing) Car Controller
export const getMyCars = async (req, res) => {
    try {
        const cars = await Car.find({ postedBy: req.user._id }).sort({ createdAt: -1 });

        return res.status(200).json({
            message: "My Cars Fetched Successfully.",
            total: cars.length,
            cars
        });
    } catch (error) {
        console.log("My Cars Errors:", error.message);
        return res.status(500).json({
            message: 'Failed to get user cars',
            error: error.message
        });
    }
};




// Get All Cars Controller with Pagination (Boosted posts prioritized)
export const getAllCars = async (req, res) => {
    try {
        // Check MongoDB connection
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                success: false,
                message: 'Database connection unavailable. Please try again later.',
                error: 'MongoDB not connected'
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        // Clean up expired boosts
        try {
            await Car.updateMany(
                { isBoosted: true, boostExpiry: { $lt: new Date() } },
                { $set: { isBoosted: false, boostPriority: 0 } }
            );
        } catch (dbError) {
            // If updateMany fails, log but continue (non-critical operation)
            console.warn("Failed to clean up expired boosts:", dbError.message);
        }

        // Build query - show approved cars (or cars without isApproved field, which defaults to true)
        const query = {
            $or: [
                { isApproved: true },
                { isApproved: { $exists: false } }
            ]
        };

        // Add condition filter if provided
        if (req.query.condition && (req.query.condition === 'new' || req.query.condition === 'used')) {
            // Use $and to combine conditions properly
            query.$and = [
                { $or: [{ isApproved: true }, { isApproved: { $exists: false } }] },
                { condition: req.query.condition }
            ];
            delete query.$or;
        }

        // Fetch cars with pagination
        // Sort: Featured first, then boosted (by priority), then by creation date
        const cars = await Car.find(query)
            .skip(skip)
            .limit(limit)
            .populate("postedBy", "name email role")
            .sort({ 
                featured: -1,
                isBoosted: -1, 
                boostPriority: -1, 
                createdAt: -1 
            });

        // Get total count
        const total = await Car.countDocuments(query);

        if (!cars || cars.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No cars found.",
                data: {
                    total: 0,
                    page,
                    pages: 0,
                    cars: []
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: "Fetched cars successfully.",
            data: {
                total,
                page,
                pages: Math.ceil(total / limit),
                cars
            }
        });
    } catch (error) {
        console.error("Get Cars Error:", error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error while fetching cars',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


// Get Single Car Controller
export const getSingleCar = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid car ID"
            });
        }

        const car = await Car.findById(id).populate("postedBy", "name email role");

        if (!car) {
            return res.status(404).json({
                success: false,
                message: "Car not found"
            });
        }

        // Check if boost is expired
        if (car.isBoosted && car.boostExpiry && new Date() > car.boostExpiry) {
            car.isBoosted = false;
            car.boostPriority = 0;
            await car.save({ validateBeforeSave: false });
        }

        // Increment views
        car.views += 1;
        await car.save({ validateBeforeSave: false });

        return res.status(200).json({
            success: true,
            message: "Single car fetched successfully",
            data: car
        });
    } catch (error) {
        console.error("Get Car Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching car",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get Car Filter Controller (Boosted posts prioritized)
/**
 * Mark Car as Sold
 */
export const markCarAsSold = async (req, res) => {
    try {
        const { carId } = req.params;
        const { isSold } = req.body;

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(carId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid car ID.",
            });
        }

        const car = await Car.findById(carId);
        if (!car) {
            return res.status(404).json({
                success: false,
                message: "Car not found.",
            });
        }

        // Check if user owns the car or is admin
        if (car.postedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to modify this car.",
            });
        }

        car.isSold = isSold === true || isSold === 'true';
        car.soldAt = car.isSold ? new Date() : null;

        await car.save();

        return res.status(200).json({
            success: true,
            message: `Car ${car.isSold ? 'marked as sold' : 'marked as available'} successfully.`,
            data: {
                _id: car._id,
                title: car.title,
                isSold: car.isSold,
                soldAt: car.soldAt
            }
        });
    } catch (error) {
        console.error("Mark Car as Sold Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const getFilteredCars = async (req, res) => {
    try {
        // Check MongoDB connection
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                success: false,
                message: 'Database connection unavailable. Please try again later.',
                error: 'MongoDB not connected'
            });
        }

        // Clean up expired boosts
        try {
            await Car.updateMany(
                { isBoosted: true, boostExpiry: { $lt: new Date() } },
                { $set: { isBoosted: false, boostPriority: 0 } }
            );
        } catch (dbError) {
            // If updateMany fails, log but continue (non-critical operation)
            console.warn("Failed to clean up expired boosts:", dbError.message);
        }

        // Validate and parse pagination parameters
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
        const skip = (page - 1) * limit;

        // Build filter query - show approved cars (or cars without isApproved field)
        const filter = buildCarQuery(req.query);
        
        // Add approval check - show approved or cars without isApproved field
        const approvalFilter = {
            $or: [
                { isApproved: true },
                { isApproved: { $exists: false } }
            ]
        };
        
        // Exclude sold cars by default (unless explicitly requested)
        const soldFilter = req.query.includeSold === 'true' ? {} : { isSold: { $ne: true } };
        
        // Combine filters using $and
        const finalFilter = {
            $and: [
                filter,
                approvalFilter,
                soldFilter
            ]
        };

        // Validate and set sort parameters
        const allowedSortFields = [
            "price", "year", "mileage", "numberOfCylinders", "carDoors", "views"
        ];
        const sortField = allowedSortFields.includes(req.query.sort) ? req.query.sort : null;
        const sortOrder = req.query.order === "asc" ? 1 : -1;

        // Build sort object - prioritize boosted posts
        let sort = {};
        if (sortField) {
            // If custom sort, still prioritize boosted posts
            sort = {
                featured: -1,
                isBoosted: -1,
                boostPriority: -1,
                [sortField]: sortOrder,
                createdAt: -1
            };
        } else {
            // Default sort: Featured > Boosted > Date
            sort = {
                featured: -1,
                isBoosted: -1,
                boostPriority: -1,
                createdAt: -1
            };
        }

        // Execute queries in parallel
        let cars, total;
        try {
            [cars, total] = await Promise.all([
                Car.find(finalFilter)
                    .sort(sort)
                    .skip(skip)
                    .limit(limit)
                    .populate("postedBy", "name email role")
                    .lean(),
                Car.countDocuments(finalFilter)
            ]);
        } catch (dbError) {
            console.error('Database query error:', dbError);
            throw new Error(`Database query failed: ${dbError.message}`);
        }

        // Calculate pagination metadata
        const pages = Math.ceil(total / limit);
        const hasNextPage = page < pages;
        const hasPreviousPage = page > 1;

        return res.status(200).json({
            success: true,
            message: "Filtered cars retrieved successfully.",
            data: {
                count: cars.length,
                total,
                page,
                pages,
                limit,
                hasNextPage,
                hasPreviousPage,
                cars,
                filters: Object.keys(req.query).length > 0 ? req.query : undefined
            }
        });

    } catch (error) {
        console.error("Get Filtered Cars Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching cars. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

