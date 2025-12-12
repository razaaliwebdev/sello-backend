import mongoose from "mongoose";
import Car from "../models/carModel.js";
import ListingHistory from "../models/listingHistoryModel.js";
import { uploadCloudinary } from '../utils/cloudinary.js'
import User from '../models/userModel.js';
import { parseArray, buildCarQuery } from '../utils/parseArray.js';
import Logger from '../utils/logger.js';
import { AppError, asyncHandler } from '../middlewares/errorHandler.js';
import { validateRequiredFields } from '../utils/vehicleFieldConfig.js';



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

        // Check if user can create posts (individuals, dealers, or admins)
        // Individual users can both buy and sell, so they can create posts
        if (req.user.role !== 'individual' && req.user.role !== 'dealer' && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only individuals, dealers, or admins can create posts.',
            });
        }

        // Check subscription limits (only for non-admin users)
        if (req.user.role !== 'admin') {
            const { SUBSCRIPTION_PLANS } = await import('./subscriptionController.js');
            const user = await User.findById(req.user._id);

            // Check if subscription is active and not expired
            const isSubscriptionActive = user.subscription?.isActive &&
                user.subscription?.endDate &&
                new Date(user.subscription.endDate) > new Date();

            const planKey = isSubscriptionActive ? (user.subscription?.plan || 'free') : 'free';
            const plan = SUBSCRIPTION_PLANS[planKey];
            const maxListings = plan.maxListings;

            // Count active listings (not sold, not deleted)
            const activeListings = await Car.countDocuments({
                postedBy: req.user._id,
                status: { $nin: ['sold', 'deleted'] },
                $or: [{ isActive: { $exists: false } }, { isActive: true }]
            });

            // Check if user has reached listing limit (unless unlimited = -1)
            if (maxListings !== -1 && activeListings >= maxListings) {
                return res.status(403).json({
                    success: false,
                    message: `You have reached your listing limit (${maxListings} listings). Please upgrade your subscription to post more listings.`,
                    upgradeRequired: true,
                    currentPlan: planKey,
                    activeListings,
                    maxListings,
                    isSubscriptionActive
                });
            }
        }

        // Extract fields from FormData
        const {
            title, description, make, model, variant, year, condition, price, colorExterior,
            colorInterior, fuelType, engineCapacity, transmission, mileage, features,
            regionalSpec, bodyType, city, location, sellerType, carDoors, contactNumber,
            geoLocation, horsepower, warranty, numberOfCylinders, ownerType, vehicleType, vehicleTypeCategory,
            batteryRange, motorPower,
        } = req.body;

        // Validate and set vehicleType first (needed for dynamic validation)
        const validVehicleTypes = ["Car", "Bus", "Truck", "Van", "Bike", "E-bike"];
        const selectedVehicleType = (vehicleType || "Car").trim();
        if (!validVehicleTypes.includes(selectedVehicleType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid vehicle type. Must be one of: ${validVehicleTypes.join(", ")}`,
            });
        }

        // Validate required fields dynamically based on vehicle type
        const validation = validateRequiredFields(selectedVehicleType, req.body);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${validation.missing.join(', ')}`,
            });
        }

        // Validate contactNumber
        if (!/^\+?\d{9,15}$/.test(contactNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid contact number. Must be 9-15 digits.',
            });
        }

        // Validate price is positive
        if (price && (isNaN(price) || parseFloat(price) <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'Price must be a positive number.',
            });
        }

        // Validate year is reasonable
        const currentYear = new Date().getFullYear();
        const yearNum = parseInt(year);
        if (isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear + 1) {
            return res.status(400).json({
                success: false,
                message: `Year must be between 1900 and ${currentYear + 1}.`,
            });
        }

        // Validate images are provided
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one car image is required.',
            });
        }

        // Validate maximum number of images
        if (req.files.length > 20) {
            return res.status(400).json({
                success: false,
                message: 'Maximum 20 images allowed per listing.',
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

        // Handle images with compression, EXIF removal, and ordering
        let images = [];
        if (req.files && req.files.length > 0) {
            // Validate file types and sizes
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            const maxSize = 20 * 1024 * 1024; // 20MB

            const validFiles = req.files.filter(file => {
                if (!allowedTypes.includes(file.mimetype)) {
                    Logger.warn('Invalid file type in car upload', { mimetype: file.mimetype, userId: req.user._id });
                    return false;
                }
                if (file.size > maxSize) {
                    Logger.warn('File too large in car upload', { size: file.size, userId: req.user._id });
                    return false;
                }
                return true;
            });

            // Upload images with compression and EXIF removal
            // Maintain order by processing sequentially or using index
            const uploadedImages = await Promise.all(
                validFiles.map(async (file, index) => {
                    try {
                        const imageUrl = await uploadCloudinary(file.buffer, {
                            folder: "sello_cars",
                            removeExif: true,
                            quality: 85, // Good balance between quality and size
                            format: "auto" // Auto format (webp when supported)
                        });
                        return { url: imageUrl, order: index };
                    } catch (err) {
                        Logger.error(`Error uploading image ${index}`, err, { userId: req.user._id, index });
                        return null;
                    }
                })
            );

            // Remove null values and sort by order, then extract URLs
            images = uploadedImages
                .filter((item) => item !== null)
                .sort((a, b) => a.order - b.order)
                .map((item) => item.url);

            // Ensure at least one image was uploaded successfully
            if (images.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Failed to upload images. Please try again with valid image files.',
                });
            }
        }


        // Vehicle type already validated above

        // Validate vehicleTypeCategory if provided
        let vehicleTypeCategoryId = null;
        if (vehicleTypeCategory) {
            if (!mongoose.Types.ObjectId.isValid(vehicleTypeCategory)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid vehicle type category ID.",
                });
            }
            // Verify category exists and is of type "vehicle"
            const Category = (await import('../models/categoryModel.js')).default;
            const category = await Category.findOne({ 
                _id: vehicleTypeCategory, 
                type: "vehicle",
                isActive: true 
            });
            if (!category) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid vehicle type category. Category must exist and be active.",
                });
            }
            vehicleTypeCategoryId = vehicleTypeCategory;
        }

        // Create car document - optimized with proper type conversion and trimming
        const carData = {
            title: String(title).trim(),
            description: (description || '').trim(),
            make: String(make).trim(),
            model: String(model).trim(),
            variant: (variant || 'N/A').trim(),
            year: parseInt(year, 10),
            condition: String(condition).trim(),
            price: parseFloat(price),
            colorExterior: (colorExterior || 'N/A').trim(),
            colorInterior: (colorInterior || 'N/A').trim(),
            fuelType: String(fuelType).trim(),
            transmission: String(transmission).trim(),
            mileage: parseInt(mileage, 10) || 0,
            features: parsedFeatures, // Already parsed and validated by parseArray
            regionalSpec: String(regionalSpec).trim(),
            vehicleType: selectedVehicleType,
            vehicleTypeCategory: vehicleTypeCategoryId,
            city: String(city).trim(),
            location: (location || '').trim(),
            sellerType: String(sellerType).trim(),
            contactNumber: String(contactNumber).trim(),
            geoLocation: {
                type: 'Point',
                coordinates: parsedGeoLocation, // [longitude, latitude]
            },
            warranty: String(warranty).trim(),
            ownerType: String(ownerType).trim(),
            images, // Array of Cloudinary URLs
            postedBy: req.user._id, // Set from authenticated user
            isApproved: true, // Auto-approve by default
            status: 'active', // Set initial status
        };

        // Conditionally add fields based on vehicle type
        // Engine Capacity - required for all except E-bike
        if (selectedVehicleType !== "E-bike") {
            const engineCap = parseInt(engineCapacity, 10);
            if (!isNaN(engineCap) && engineCap > 0) {
                carData.engineCapacity = engineCap;
            }
        }
        // Don't set engineCapacity for E-bike (even if sent, ignore it)

        // Body Type - required for Car and Van only
        if (selectedVehicleType === "Car" || selectedVehicleType === "Van") {
            if (bodyType && bodyType.trim() !== '') {
                carData.bodyType = String(bodyType).trim();
            }
        }
        // Don't set bodyType for other vehicle types

        // Car Doors - only for Car and Van
        if (selectedVehicleType === "Car" || selectedVehicleType === "Van") {
            const doors = parseInt(carDoors, 10);
            carData.carDoors = (!isNaN(doors) && doors > 0) ? doors : 4;
        }
        // Don't set carDoors for other vehicle types

        // Horsepower - optional for most, not for E-bike
        if (selectedVehicleType !== "E-bike") {
            const hp = parseInt(horsepower, 10);
            if (!isNaN(hp) && hp >= 0) {
                carData.horsepower = hp;
            }
        }
        // Don't set horsepower for E-bike

        // Number of Cylinders - not for E-bike or Bike
        if (selectedVehicleType !== "E-bike" && selectedVehicleType !== "Bike") {
            const cyl = parseInt(numberOfCylinders, 10);
            if (!isNaN(cyl) && cyl > 0) {
                carData.numberOfCylinders = cyl;
            }
        }
        // Don't set numberOfCylinders for E-bike or Bike

        // E-bike specific fields - only set for E-bike
        if (selectedVehicleType === "E-bike") {
            const batRange = parseInt(batteryRange, 10);
            if (!isNaN(batRange) && batRange > 0) {
                carData.batteryRange = batRange;
            }
            const motPower = parseInt(motorPower, 10);
            if (!isNaN(motPower) && motPower > 0) {
                carData.motorPower = motPower;
            }
        }
        // Don't set batteryRange/motorPower for non-E-bike vehicles

        // console.log('Car data before saving:', carData);

        const car = await Car.create(carData);

        // Update user's carsPosted array
        await User.findByIdAndUpdate(req.user._id, {
            $push: { carsPosted: car._id }
        });

        // Refresh user data to get updated role if it was upgraded
        const updatedUser = await User.findById(req.user._id).select('role name email');

        return res.status(201).json({
            success: true,
            message: 'Car post created successfully',
            data: {
                car,
                user: updatedUser ? {
                    role: updatedUser.role,
                    name: updatedUser.name,
                    email: updatedUser.email
                } : null
            },
        });
    } catch (error) {
        Logger.error('Error creating car', error, { userId: req.user?._id });
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
                success: false,
                message: "Invalid car ID"
            });
        }

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated"
            });
        }

        const car = await Car.findById(id);
        if (!car) {
            return res.status(404).json({
                success: false,
                message: "Car not found"
            });
        }

        // Only owner or admin can update
        if (car.postedBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to update this car."
            });
        }

        // Extract fields from request body
        const updateData = { ...req.body };

        // Handle image updates if new images are provided
        if (req.files && req.files.length > 0) {
            // Validate file types and sizes
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            const maxSize = 20 * 1024 * 1024; // 20MB

            const validFiles = req.files.filter(file => {
                if (!allowedTypes.includes(file.mimetype)) {
                    Logger.warn('Invalid file type in car upload', { mimetype: file.mimetype, userId: req.user._id });
                    return false;
                }
                if (file.size > maxSize) {
                    Logger.warn('File too large in car upload', { size: file.size, userId: req.user._id });
                    return false;
                }
                return true;
            });

            // Upload new images with compression and EXIF removal
            const uploadedImages = await Promise.all(
                validFiles.map(async (file, index) => {
                    try {
                        const imageUrl = await uploadCloudinary(file.buffer, {
                            folder: "sello_cars",
                            removeExif: true,
                            quality: 85,
                            format: "auto"
                        });
                        return { url: imageUrl, order: index };
                    } catch (err) {
                        Logger.error(`Error uploading image ${index}`, err, { userId: req.user._id, index });
                        return null;
                    }
                })
            );
            const newImages = uploadedImages
                .filter((item) => item !== null)
                .sort((a, b) => a.order - b.order)
                .map((item) => item.url);

            // If existing images are provided in body, merge them; otherwise replace
            if (updateData.existingImages && Array.isArray(updateData.existingImages)) {
                updateData.images = [...updateData.existingImages, ...newImages];
            } else {
                updateData.images = newImages;
            }
            delete updateData.existingImages;
        } else if (updateData.existingImages) {
            // Only existing images, no new uploads
            updateData.images = Array.isArray(updateData.existingImages)
                ? updateData.existingImages
                : [updateData.existingImages];
            delete updateData.existingImages;
        }

        // Parse geoLocation if provided
        if (updateData.geoLocation && typeof updateData.geoLocation === 'string') {
            try {
                const parsedGeoLocation = JSON.parse(updateData.geoLocation);
                if (Array.isArray(parsedGeoLocation) && parsedGeoLocation.length === 2) {
                    updateData.geoLocation = {
                        type: 'Point',
                        coordinates: parsedGeoLocation
                    };
                }
            } catch (e) {
                // Invalid geoLocation format, remove it
                delete updateData.geoLocation;
            }
        }

        // Parse features if provided
        if (updateData.features) {
            updateData.features = parseArray(updateData.features);
        }

        // Convert numeric fields
        if (updateData.year) updateData.year = parseInt(updateData.year);
        if (updateData.price) updateData.price = parseFloat(updateData.price);
        if (updateData.mileage) updateData.mileage = parseInt(updateData.mileage);
        if (updateData.carDoors) updateData.carDoors = parseInt(updateData.carDoors);
        if (updateData.numberOfCylinders) updateData.numberOfCylinders = parseInt(updateData.numberOfCylinders);
        if (updateData.engineCapacity) updateData.engineCapacity = parseInt(updateData.engineCapacity);
        if (updateData.horsepower) updateData.horsepower = parseInt(updateData.horsepower);

        // Validate contactNumber if provided
        if (updateData.contactNumber && !/^\+?\d{9,15}$/.test(updateData.contactNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid contact number. Must be 9-15 digits.'
            });
        }

        // Update car
        const updatedCar = await Car.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate({
            path: "postedBy",
            select: "name email role avatar dealerInfo"
        });

        return res.status(200).json({
            success: true,
            message: "Car updated successfully.",
            data: updatedCar
        });

    } catch (error) {
        Logger.error("Update Car Error", error, { userId: req.user?._id, carId: id });
        return res.status(500).json({
            success: false,
            message: "Server error while updating car",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
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
// This shows cars posted by user that are not fully deleted
export const getMyCars = async (req, res) => {
    try {
        const cars = await Car.find({
            postedBy: req.user._id,
            status: { $ne: "deleted" },
        })
            .sort({ createdAt: -1 })
            .populate({
                path: "postedBy",
                select: "name email role"
            });

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
            Logger.warn("Failed to clean up expired boosts", { error: dbError.message });
        }

        const now = new Date();

        // Build query - show approved cars (or cars without isApproved field, which defaults to true)
        // Exclude hard-deleted cars, and exclude sold cars past their autoDeleteDate
        const baseQuery = {
            $and: [
                {
                    $or: [{ isApproved: true }, { isApproved: { $exists: false } }],
                },
                {
                    status: { $ne: "deleted" },
                },
                {
                    $or: [
                        { status: { $ne: "sold" } },
                        { autoDeleteDate: { $gt: now } },
                        // Backwards-compatibility: listings without autoDeleteDate stay visible
                        { autoDeleteDate: { $exists: false } },
                    ],
                },
            ],
        };

        // If includeSold is explicitly set to 'true', also allow sold ones through (still respecting autoDeleteDate)
        if (req.query.includeSold === "true") {
            baseQuery.$and = baseQuery.$and.filter(
                (clause) =>
                    !(
                        clause.$or &&
                        clause.$or.some((c) => c.status && c.status.$ne === "sold")
                    )
            );
        }

        // Add condition filter if provided
        let query = { ...baseQuery };
        if (
            req.query.condition &&
            (req.query.condition === "new" || req.query.condition === "used")
        ) {
            // Use $and to combine conditions properly
            query = {
                $and: [
                    { $or: [{ isApproved: true }, { isApproved: { $exists: false } }] },
                    { condition: req.query.condition },
                ]
            };
        }

        // Add vehicleType filter if provided
        if (req.query.vehicleType) {
            const validVehicleTypes = ["Car", "Bus", "Truck", "Van", "Bike", "E-bike"];
            const vehicleTypes = Array.isArray(req.query.vehicleType) 
                ? req.query.vehicleType 
                : [req.query.vehicleType];
            const validTypes = vehicleTypes.filter(vt => validVehicleTypes.includes(vt));
            if (validTypes.length > 0) {
                query.vehicleType = { $in: validTypes };
            }
        }

        // Add vehicleTypeCategory filter if provided
        if (req.query.vehicleTypeCategory) {
            if (mongoose.Types.ObjectId.isValid(req.query.vehicleTypeCategory)) {
                query.vehicleTypeCategory = new mongoose.Types.ObjectId(req.query.vehicleTypeCategory);
            }
        }

        // Add featured filter if provided
        if (req.query.featured === 'true' || req.query.featured === true) {
            query.featured = true;
            console.log('Featured filter applied:', query.featured);
        }

        // Fetch cars with pagination
        // Sort: Featured first, then boosted (by priority), then by creation date
        const cars = await Car.find(query)
            .skip(skip)
            .limit(limit)
            .populate({
                path: "postedBy",
                select: "name email role sellerRating reviewCount isVerified dealerInfo"
            })
            .sort({
                featured: -1,
                isBoosted: -1,
                boostPriority: -1,
                // push sold listings lower in the results, similar to OLX / PakWheels
                status: 1, // "active" < "sold" < "expired" < "deleted"
                createdAt: -1,
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
        Logger.error("Get Cars Error", error);
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

        const car = await Car.findById(id).populate({
            path: "postedBy",
            select: "name email role sellerRating reviewCount isVerified avatar dealerInfo"
        });

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

        // Track recently viewed if user is authenticated
        if (req.user) {
            try {
                const RecentlyViewed = (await import('../models/recentlyViewedModel.js')).default;
                await RecentlyViewed.findOneAndUpdate(
                    { user: req.user._id, car: car._id },
                    { viewedAt: new Date() },
                    { upsert: true, new: true }
                );
            } catch (viewError) {
                // Don't fail the request if tracking fails
                Logger.error('Failed to track recently viewed', viewError, { carId: id });
            }
        }

        // Track analytics
        try {
            const { trackEvent, AnalyticsEvents } = await import('../utils/analytics.js');
            await trackEvent(AnalyticsEvents.LISTING_VIEW, req.user?._id, {
                carId: car._id.toString(),
                make: car.make,
                model: car.model
            });
        } catch (analyticsError) {
            // Don't fail the request if analytics fails
            Logger.error('Failed to track analytics', analyticsError, { carId: id });
        }

        return res.status(200).json({
            success: true,
            message: "Single car fetched successfully",
            data: car
        });
    } catch (error) {
        Logger.error("Get Car Error", error, { carId: id });
        return res.status(500).json({
            success: false,
            message: "Server error while fetching car",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get Car Filter Controller (Boosted posts prioritized)
/**
 * Mark Car as Sold / Available
 * - When marking as sold:
 *   - status = 'sold'
 *   - soldAt / soldDate = now
 *   - autoDeleteDate = soldDate + 7 days
 * - When marking as available (undo sold):
 *   - status = 'active'
 *   - sold flags cleared
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
        if (
            car.postedBy.toString() !== req.user._id.toString() &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to modify this car.",
            });
        }

        const markSold = isSold === true || isSold === "true";
        const now = new Date();

        car.isSold = markSold;
        car.soldAt = markSold ? now : null;
        car.soldDate = markSold ? now : null;
        car.status = markSold ? "sold" : "active";
        car.isAutoDeleted = false;
        car.deletedAt = null;
        car.deletedBy = null;
        car.autoDeleteDate = markSold
            ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
            : null;

        await car.save();

        return res.status(200).json({
            success: true,
            message: `Car ${car.isSold ? "marked as sold" : "marked as available"
                } successfully.`,
            data: {
                _id: car._id,
                title: car.title,
                isSold: car.isSold,
                soldAt: car.soldAt,
                soldDate: car.soldDate,
                status: car.status,
                autoDeleteDate: car.autoDeleteDate,
            },
        });
    } catch (error) {
        Logger.error("Mark Car as Sold Error", error, { userId: req.user?._id, carId });
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error:
                process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

export const getFilteredCars = async (req, res) => {
    try {
        // Clean up expired boosts
        try {
            await Car.updateMany(
                { isBoosted: true, boostExpiry: { $lt: new Date() } },
                { $set: { isBoosted: false, boostPriority: 0 } }
            );
        } catch (dbError) {
            // If updateMany fails, log but continue (non-critical operation)
            Logger.warn("Failed to clean up expired boosts", { error: dbError.message });
        }

        // Validate and parse pagination parameters
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
        const skip = (page - 1) * limit;

        // Build filter query - show approved cars (or cars without isApproved field)
        let filter, locationFilter;
        try {
            console.log('getFilteredCars - req.query:', JSON.stringify(req.query, null, 2));
            const queryResult = buildCarQuery(req.query);
            filter = queryResult.filter;
            locationFilter = queryResult.locationFilter;
            console.log('getFilteredCars - built filter:', JSON.stringify(filter, null, 2));
        } catch (queryError) {
            Logger.warn('Invalid filter query parameters', { error: queryError.message, query: req.query });
            return res.status(400).json({
                success: false,
                message: `Invalid filter parameters: ${queryError.message}`,
            });
        }

        // Add approval check - show approved or cars without isApproved field
        const approvalFilter = {
            $or: [
                { isApproved: true },
                { isApproved: { $exists: false } }
            ]
        };

        const now = new Date();

        // Visibility filter: exclude deleted, and sold cars after their autoDeleteDate
        const visibilityFilter = {
            status: { $ne: "deleted" },
            $or: [
                { status: { $ne: "sold" } },
                { autoDeleteDate: { $gt: now } },
                { autoDeleteDate: { $exists: false } }
            ]
        };

        // Combine filters using $and
        const finalFilter = {
            $and: [
                filter,
                approvalFilter,
                visibilityFilter
            ]
        };
        
        console.log('getFilteredCars - finalFilter:', JSON.stringify(finalFilter, null, 2));

        // Add geospatial filter if location radius is specified
        if (locationFilter.radius && locationFilter.userLocation) {
            // Use $near to find cars within radius (in meters)
            const radiusInMeters = locationFilter.radius * 1000; // Convert km to meters
            finalFilter.$and.push({
                geoLocation: {
                    $near: {
                        $geometry: locationFilter.userLocation,
                        $maxDistance: radiusInMeters
                    }
                }
            });
        }

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

        // Execute queries in parallel - optimized
        let cars, total;
        try {
            // Build query with select to only get needed fields (performance optimization)
            const selectFields = 'title make model year condition price images city location mileage fuelType transmission bodyType regionalSpec postedBy createdAt views isBoosted featured';

            [cars, total] = await Promise.all([
                Car.find(finalFilter)
                    .select(selectFields)
                    .sort(sort)
                    .skip(skip)
                    .limit(limit)
                    .populate({
                        path: "postedBy",
                        select: "name email role sellerRating reviewCount isVerified avatar dealerInfo"
                    })
                    .lean(),
                Car.countDocuments(finalFilter)
            ]);
            
            console.log(`getFilteredCars - Found ${cars.length} cars (total: ${total}) with featured filter`);
            if (req.query.featured === 'true' || req.query.featured === true) {
                console.log('Featured cars details:', cars.map(c => ({ id: c._id, title: c.title, featured: c.featured, isApproved: c.isApproved, status: c.status })));
            }
        } catch (dbError) {
            Logger.error('Database query error in getFilteredCars', dbError);
            return res.status(500).json({
                success: false,
                message: 'Database query failed. Please try again later.',
                error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
            });
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
        Logger.error("Get Filtered Cars Error", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching cars. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

