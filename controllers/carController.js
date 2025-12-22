import mongoose from "mongoose";
import Car from "../models/carModel.js";
import ListingHistory from "../models/listingHistoryModel.js";
import { uploadCloudinary } from '../utils/cloudinary.js'
import User from '../models/userModel.js';
import { parseArray, buildCarQuery } from '../utils/parseArray.js';
import Logger from '../utils/logger.js';
import { AppError, asyncHandler } from '../middlewares/errorHandler.js';
import { validateRequiredFields } from '../utils/vehicleFieldConfig.js';
import { getPriceAnalysis } from '../utils/priceAnalysis.js';



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
            // Note: 'country' field is sent from frontend but not stored in Car model (city provides location context)
        } = req.body;

        // Normalize make/model early for duplicate checking
        const normalizeString = (str) => {
            if (!str || typeof str !== 'string') return str;
            return str.trim()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        };

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

        // Validate and prepare mileage tracking
        const mileageNum = parseInt(mileage, 10) || 0;
        if (mileageNum < 0) {
            return res.status(400).json({
                success: false,
                message: 'Mileage cannot be negative.',
            });
        }

        // Create initial mileage history entry
        const mileageHistoryEntry = {
            mileage: mileageNum,
            recordedAt: new Date(),
            recordedBy: req.user._id,
            source: 'listing'
        };

        // Flag suspicious mileage (e.g., very low for old car)
        const carAge = currentYear - yearNum;
        const suspiciousMileage = carAge > 5 && mileageNum < 10000;

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

        // Parse geoLocation (optional field - use default if not provided)
        let parsedGeoLocation = null;
        if (geoLocation) {
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
                    // Invalid format, but don't fail - just set to null (optional field)
                    parsedGeoLocation = null;
                    Logger.warn("Invalid geoLocation format, using default", { geoLocation, userId: req.user?._id });
                }
            } catch (error) {
                // Invalid JSON, but don't fail - just set to null (optional field)
                parsedGeoLocation = null;
                Logger.warn("Failed to parse geoLocation, using default", { geoLocation, error: error.message, userId: req.user?._id });
            }
        }
        
        // Use default location (Dubai, UAE) if geoLocation is not provided
        if (!parsedGeoLocation) {
            parsedGeoLocation = [55.2708, 25.2048]; // [longitude, latitude] for Dubai, UAE
        }

        // Check for potential duplicate listings (unless force=true)
        if (req.query.force !== 'true') {
            const normalizedMake = normalizeString(make);
            const normalizedModel = normalizeString(model);
            const priceNum = parseFloat(price);
            
            const similarListings = await Car.find({
                make: normalizedMake,
                model: normalizedModel,
                year: yearNum,
                postedBy: req.user._id,
                status: { $ne: 'deleted' },
                // Price within 10% (to account for negotiation)
                price: {
                    $gte: priceNum * 0.90,
                    $lte: priceNum * 1.10
                }
            }).limit(5);

            // If similar listing exists and was created recently (within 30 days), warn user
            const recentDuplicates = similarListings.filter(car => {
                const daysSinceCreated = (new Date() - new Date(car.createdAt)) / (1000 * 60 * 60 * 24);
                return daysSinceCreated < 30;
            });

            if (recentDuplicates.length > 0) {
                Logger.warn('Potential duplicate listing detected', {
                    userId: req.user._id,
                    make: normalizedMake,
                    model: normalizedModel,
                    year: yearNum,
                    similarCount: recentDuplicates.length
                });
                
                // Return warning but allow override with force flag
                return res.status(409).json({
                    success: false,
                    message: 'A similar listing already exists. If this is a different vehicle, add ?force=true to proceed.',
                    duplicateWarning: true,
                    similarListings: recentDuplicates.map(car => ({
                        _id: car._id,
                        title: car.title,
                        price: car.price,
                        createdAt: car.createdAt,
                        status: car.status
                    }))
                });
            }
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

            // Validate image quality (if enabled via environment variable)
            // Note: Requires 'sharp' package for full validation: npm install sharp
            if (process.env.ENABLE_IMAGE_QUALITY_VALIDATION === 'true') {
                try {
                    const { validateMultipleImages } = await import('../utils/imageValidation.js');
                    const imageBuffers = validFiles.map(file => file.buffer);
                    const validation = await validateMultipleImages(imageBuffers, {
                        minWidth: 400,
                        minHeight: 300,
                        minFileSize: 50 * 1024, // 50KB minimum
                        maxFileSize: maxSize
                    });

                    if (!validation.valid && validation.errors.length > 0) {
                        return res.status(400).json({
                            success: false,
                            message: 'Image quality validation failed',
                            errors: validation.errors,
                            warnings: validation.warnings
                        });
                    }

                    // Log warnings but allow upload
                    if (validation.warnings.length > 0) {
                        Logger.warn('Image quality warnings', {
                            userId: req.user._id,
                            warnings: validation.warnings
                        });
                    }
                } catch (validationError) {
                    // If validation fails (e.g., sharp not installed), log and continue
                    Logger.warn('Image quality validation skipped', {
                        error: validationError.message,
                        userId: req.user._id
                    });
                }
            }

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

        // Check auto-approve listings setting
        const Settings = (await import('../models/settingsModel.js')).default;
        const autoApproveListingsSetting = await Settings.findOne({ key: 'autoApproveListings' });
        const autoApproveListings = autoApproveListingsSetting && 
            (autoApproveListingsSetting.value === true || 
             autoApproveListingsSetting.value === 'true' || 
             autoApproveListingsSetting.value === 1 || 
             autoApproveListingsSetting.value === '1');

        // Auto-approve if setting is enabled OR if user is admin
        const shouldAutoApprove = autoApproveListings || req.user.role === 'admin';

        // Create car document - optimized with proper type conversion and trimming
        // normalizeString function already defined above for duplicate checking
        
        const carData = {
            title: String(title).trim(),
            description: (description || '').trim(),
            make: normalizeString(make),
            model: normalizeString(model),
            variant: (variant || 'N/A').trim(),
            year: parseInt(year, 10),
            condition: String(condition).trim(),
            price: parseFloat(price),
            colorExterior: (colorExterior || 'N/A').trim(),
            colorInterior: (colorInterior || 'N/A').trim(),
            fuelType: String(fuelType).trim(),
            transmission: String(transmission).trim(),
            mileage: mileageNum,
            mileageHistory: [mileageHistoryEntry],
            mileageVerified: false,
            mileageFlagged: suspiciousMileage,
            mileageFlagReason: suspiciousMileage ? 'Suspiciously low mileage for vehicle age' : null,
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
            isApproved: shouldAutoApprove, // Use setting or admin status
            status: 'active', // Set initial status
            // Set expiry date (90 days from now, or use provided value if any)
            expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : (() => {
                const expiry = new Date();
                expiry.setDate(expiry.getDate() + 90); // Default: 90 days
                return expiry;
            })(),
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

        // Body Type - required for Car, Van, Bus, and Truck
        if (selectedVehicleType === "Car" || selectedVehicleType === "Van" || 
            selectedVehicleType === "Bus" || selectedVehicleType === "Truck") {
            if (bodyType && bodyType.trim() !== '') {
                carData.bodyType = String(bodyType).trim();
            }
        }
        // Don't set bodyType for Bike and E-bike

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

        // Number of Cylinders - not for E-bike (Bikes DO have cylinders: 1, 2, 3, 4, or 6)
        if (selectedVehicleType !== "E-bike") {
            const cyl = parseInt(numberOfCylinders, 10);
            if (!isNaN(cyl) && cyl > 0) {
                carData.numberOfCylinders = cyl;
            }
        }
        // Don't set numberOfCylinders for E-bike only

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
            // E-bikes are electric - set fuelType to Electric if not provided
            if (!fuelType || fuelType.trim() === '') {
                carData.fuelType = "Electric";
            }
            // Transmission is optional for E-bikes
            if (!transmission || transmission.trim() === '') {
                carData.transmission = "Automatic"; // Most E-bikes are automatic
            }
        }
        // Don't set batteryRange/motorPower for non-E-bike vehicles

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

        // Normalize make/model if being updated (for data consistency)
        if (updateData.make && typeof updateData.make === 'string') {
            updateData.make = updateData.make.trim()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        }
        if (updateData.model && typeof updateData.model === 'string') {
            updateData.model = updateData.model.trim()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        }

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

        // Validate mileage if being updated
        if (updateData.mileage !== undefined) {
            const newMileage = parseInt(updateData.mileage, 10);
            
            if (newMileage < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Mileage cannot be negative.',
                });
            }
            
            // Check if mileage is decreasing (possible odometer rollback)
            if (car.mileage && newMileage < car.mileage) {
                return res.status(400).json({
                    success: false,
                    message: 'Mileage cannot decrease. If this is a correction, please contact support.',
                });
            }
            
            // Add to mileage history
            if (!car.mileageHistory) car.mileageHistory = [];
            car.mileageHistory.push({
                mileage: newMileage,
                recordedAt: new Date(),
                recordedBy: req.user._id,
                source: 'update'
            });
            
            // Check for suspicious changes (large increases)
            if (car.mileage && newMileage - car.mileage > 50000) {
                car.mileageFlagged = true;
                car.mileageFlagReason = 'Large mileage increase detected';
            } else if (car.mileageFlagged && newMileage > car.mileage) {
                // Clear flag if mileage increases normally
                car.mileageFlagged = false;
                car.mileageFlagReason = null;
            }
            
            updateData.mileageHistory = car.mileageHistory;
            updateData.mileageFlagged = car.mileageFlagged;
            updateData.mileageFlagReason = car.mileageFlagReason;
        }

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
        Logger.error("Delete Car Error", error, { carId: req.params.id, userId: req.user?._id });
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
// Optional query param: status (active, sold, expired, all)
export const getMyCars = async (req, res) => {
    try {
        const statusFilter = req.query.status; // Optional: 'active', 'sold', 'expired', or undefined (all)
        
        // Build query
        const query = {
            postedBy: req.user._id,
            status: { $ne: "deleted" }, // Exclude fully deleted
        };
        
        // Apply status filter if provided
        if (statusFilter && statusFilter !== 'all') {
            if (statusFilter === 'active') {
                query.status = 'active';
            } else if (statusFilter === 'sold') {
                query.status = 'sold';
            } else if (statusFilter === 'expired') {
                query.status = 'expired';
            }
        }
        
        const cars = await Car.find(query)
            .sort({ createdAt: -1 })
            .populate({
                path: "postedBy",
                select: "name email role"
            });

        // Count by status for stats
        const stats = {
            total: await Car.countDocuments({ postedBy: req.user._id, status: { $ne: "deleted" } }),
            active: await Car.countDocuments({ postedBy: req.user._id, status: 'active' }),
            sold: await Car.countDocuments({ postedBy: req.user._id, status: 'sold' }),
            expired: await Car.countDocuments({ postedBy: req.user._id, status: 'expired' }),
        };

        return res.status(200).json({
            message: "My Cars Fetched Successfully.",
            total: cars.length,
            stats,
            cars
        });
    } catch (error) {
        Logger.error("My Cars Errors", error, { userId: req.user?._id });
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
        // Exclude hard-deleted, expired, and sold cars past their autoDeleteDate
        const baseQuery = {
            $and: [
                {
                    $or: [{ isApproved: true }, { isApproved: { $exists: false } }],
                },
                {
                    status: { $nin: ["deleted", "expired"] }, // Exclude deleted and expired
                },
                {
                    // Allow sold listings only if they haven't passed autoDeleteDate
                    $or: [
                        { status: { $ne: "sold" } },
                        {
                            status: "sold",
                            $or: [
                                { autoDeleteDate: { $gt: now } },
                                { autoDeleteDate: { $exists: false } }
                            ]
                        },
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
        // Note: condition enum values are "New" and "Used" (capitalized), but query might use lowercase
        let query = { ...baseQuery };
        if (req.query.condition) {
            const conditionValue = req.query.condition;
            // Normalize condition value (capitalize first letter)
            const normalizedCondition = conditionValue.charAt(0).toUpperCase() + conditionValue.slice(1).toLowerCase();
            if (normalizedCondition === "New" || normalizedCondition === "Used") {
                query = {
                    $and: [
                        ...baseQuery.$and,
                        { condition: normalizedCondition }
                    ]
                };
            }
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
        }

        // Fetch cars with pagination - optimized with .lean() and .select()
        // Sort: Featured first, then boosted (by priority), then by creation date
        const cars = await Car.find(query)
            .select('title make model year price images city location status isBoosted boostExpiry boostPriority featured condition fuelType transmission mileage sellerType postedBy createdAt views geoLocation vehicleType')
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
            })
            .lean(); // Use lean() for read-only queries - much faster

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

        const car = await Car.findById(id)
            .populate({
                path: "postedBy",
                select: "name email role sellerRating reviewCount isVerified avatar dealerInfo"
            });
        
        // Note: Can't use .lean() here because we need to modify the document (views increment)

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

        // Get price analysis (non-blocking, return in response if available)
        let priceAnalysis = null;
        try {
            priceAnalysis = await getPriceAnalysis(car);
        } catch (priceError) {
            // Don't fail the request if price analysis fails
            Logger.warn('Price analysis failed', priceError, { carId: id });
        }

        // Convert car to plain object and add price analysis
        const carData = car.toObject ? car.toObject() : car;
        if (priceAnalysis) {
            carData.priceAnalysis = priceAnalysis;
        }

        return res.status(200).json({
            success: true,
            message: "Single car fetched successfully",
            data: carData
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
            ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days for sold listings
            : null;
        
        // If marking as available (relisting), reset expiry date (extend by 90 days)
        if (!markSold) {
            const newExpiry = new Date();
            newExpiry.setDate(newExpiry.getDate() + 90);
            car.expiryDate = newExpiry;
            car.actualSalePrice = null; // Clear sale price when relisting
        }
        
        // Store actual sale price if provided (optional, for analytics)
        if (markSold && req.body.actualSalePrice) {
            const salePrice = parseFloat(req.body.actualSalePrice);
            if (!isNaN(salePrice) && salePrice > 0) {
                car.actualSalePrice = salePrice;
            }
        }

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

/**
 * Get Car Counts by Make (Brand Statistics)
 */
export const getCarCountsByMake = async (req, res) => {
    try {
        // Count active, non-sold cars grouped by make (case-insensitive)
        const counts = await Car.aggregate([
            {
                $match: {
                    status: 'active',
                    isSold: { $ne: true },
                    isApproved: { $ne: false },
                    make: { $exists: true, $ne: null, $ne: '' }
                }
            },
            {
                $group: {
                    _id: { $toLower: { $trim: { input: "$make" } } }, // Group by lowercase make name
                    count: { $sum: 1 },
                    originalMake: { $first: { $trim: { input: "$make" } } } // Keep original case for reference
                }
            },
            {
                $project: {
                    _id: 0,
                    make: "$_id", // This is now lowercase
                    count: 1
                }
            },
            {
                $sort: { make: 1 }
            }
        ]);

        // Convert to object for easy lookup (already normalized to lowercase)
        const countsMap = {};
        counts.forEach(item => {
            countsMap[item.make] = item.count;
        });

        return res.status(200).json({
            success: true,
            message: "Car counts by make retrieved successfully.",
            data: countsMap
        });
    } catch (error) {
        Logger.error("Get Car Counts By Make Error", error);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
            const queryResult = buildCarQuery(req.query);
            filter = queryResult.filter;
            locationFilter = queryResult.locationFilter;
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

        // Visibility filter: exclude deleted, sold cars after their autoDeleteDate, and expired listings
        const visibilityFilter = {
            status: { $nin: ["deleted", "expired", "sold"] }, // Exclude deleted, expired, and sold by default
            $or: [
                // Allow sold listings if they haven't passed autoDeleteDate
                {
                    status: "sold",
                    $or: [
                        { autoDeleteDate: { $gt: now } },
                        { autoDeleteDate: { $exists: false } }
                    ]
                },
                // Allow active listings
                { status: "active" }
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

/**
 * Relist a sold or expired listing
 * Creates a new active listing from sold/expired listing data
 */
export const relistCar = async (req, res) => {
    try {
        const { carId } = req.params;

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

        const oldCar = await Car.findById(carId);
        if (!oldCar) {
            return res.status(404).json({
                success: false,
                message: "Car not found.",
            });
        }

        // Check if user owns the car or is admin
        if (
            oldCar.postedBy.toString() !== req.user._id.toString() &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to relist this car.",
            });
        }

        // Only allow relisting sold or expired listings
        if (oldCar.status !== "sold" && oldCar.status !== "expired") {
            return res.status(400).json({
                success: false,
                message: "Only sold or expired listings can be relisted.",
            });
        }

        // Create new listing data from old listing
        const newCarData = {
            title: oldCar.title,
            description: oldCar.description,
            make: oldCar.make,
            model: oldCar.model,
            variant: oldCar.variant,
            year: oldCar.year,
            condition: oldCar.condition,
            price: oldCar.price,
            colorExterior: oldCar.colorExterior,
            colorInterior: oldCar.colorInterior,
            fuelType: oldCar.fuelType,
            transmission: oldCar.transmission,
            mileage: oldCar.mileage,
            features: oldCar.features,
            regionalSpec: oldCar.regionalSpec,
            bodyType: oldCar.bodyType,
            city: oldCar.city,
            location: oldCar.location,
            sellerType: oldCar.sellerType,
            contactNumber: oldCar.contactNumber,
            geoLocation: oldCar.geoLocation,
            warranty: oldCar.warranty,
            ownerType: oldCar.ownerType,
            vehicleType: oldCar.vehicleType,
            vehicleTypeCategory: oldCar.vehicleTypeCategory,
            postedBy: req.user._id,
            status: "active",
            isApproved: oldCar.isApproved,
            images: oldCar.images,
        };

        // Set expiry date (90 days from now)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 90);
        newCarData.expiryDate = expiryDate;

        // Conditionally add optional fields
        if (oldCar.engineCapacity) newCarData.engineCapacity = oldCar.engineCapacity;
        if (oldCar.horsepower) newCarData.horsepower = oldCar.horsepower;
        if (oldCar.numberOfCylinders) newCarData.numberOfCylinders = oldCar.numberOfCylinders;
        if (oldCar.carDoors) newCarData.carDoors = oldCar.carDoors;
        if (oldCar.batteryRange) newCarData.batteryRange = oldCar.batteryRange;
        if (oldCar.motorPower) newCarData.motorPower = oldCar.motorPower;

        // Create new listing
        const newCar = await Car.create(newCarData);

        // Update user's carsPosted array
        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { carsPosted: newCar._id }
        });

        Logger.info(`Car relisted`, {
            oldCarId: carId,
            newCarId: newCar._id,
            userId: req.user._id,
            oldStatus: oldCar.status
        });

        return res.status(201).json({
            success: true,
            message: "Listing relisted successfully. You can edit the details if needed.",
            data: newCar
        });

    } catch (error) {
        Logger.error("Relist Car Error", error, { userId: req.user?._id, carId: req.params.carId });
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

