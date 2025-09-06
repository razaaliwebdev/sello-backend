import mongoose from "mongoose";
import Car from "../models/carModel.js";
import { buildCarQuery } from '../utils/buildCarQuery.js';
import { uploadCloudinary } from '../utils/cloudinary.js'




// Create Car Controller
export const createCar = async (req, res) => {
    try {
        const {
            make, model, variant, year, condition,
            price, colorExterior, colorInterior, fuelType, engineCapacity,
            transmission, mileage, features, city, location, sellerType,
            carDoors, contactNumber, geoLocation, horsepower, warranty, regionalSpec, bodyType,
            numberOfCylinders, ownerType
        } = req.body;

        // console.log(req.body);

        if (!make || !model || !year || !condition || !price || !city || !contactNumber) {
            return res.status(400).json({
                message: "Missing required fields: make, model, year, condition, price, city, contactNumber"
            });
        }

        if (!["Used", "New"].includes(condition)) {
            return res.status(400).json({ message: "Invalid condition value. Must be 'new' or 'used'." });
        }

        console.log("Received files:", req.files?.length || 0);

        let imageUrls = [];
        if (req.files && req.files.length > 0) {
            console.log("Uploading images...");
            const uploadPromises = req.files.map(file => uploadCloudinary(file.buffer));
            imageUrls = await Promise.all(uploadPromises);
            console.log("Images uploaded.");
        }

        console.log("Creating car...");

        const newCar = await Car.create({
            images: imageUrls,
            make,
            model,
            variant,
            year,
            condition,
            price,
            colorExterior,
            colorInterior,
            fuelType,
            engineCapacity,
            transmission,
            mileage,
            features: features ? features.split(",") : [],
            city,
            location,
            sellerType,
            carDoors,
            contactNumber,
            geoLocation,
            horsepower,
            warranty,
            regionalSpec,
            bodyType,
            numberOfCylinders,
            ownerType,
            postedBy: req.user._id
        });

        console.log("Car created.");

        return res.status(201).json({
            message: "Car created successfully.",
            car: newCar
        });

    } catch (error) {
        console.error("Create Car Error:", error);
        return res.status(500).json({
            message: "Server error while creating car",
            error: error.message
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




// Get All Cars Controller with Pagination
export const getAllCars = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        // Fetch cars with pagination
        const cars = await Car.find()
            .skip(skip)
            .limit(limit)
            .populate("postedBy", "name email role")
            .sort({ createdAt: -1 });

        // Get total count
        const total = await Car.countDocuments();

        if (!cars || cars.length === 0) {
            return res.status(200).json({
                message: "No cars found.",
                total: 0,
                page,
                pages: 0,
                cars: []
            });
        }

        return res.status(200).json({
            message: "Fetched cars successfully.",
            total,
            page,
            pages: Math.ceil(total / limit),
            cars
        });
    } catch (error) {
        console.error("Get Cars Error:", error.message);
        return res.status(500).json({
            message: 'Server error while fetching cars',
            error: error.message
        });
    }
};


// Get Single Car Controller
export const getSingleCar = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid car ID"
            })
        };

        const car = await Car.findById(id).populate("postedBy", "name email role");

        if (!car) {
            return res.status(404).json(
                {
                    message: "Car not found"
                }
            )
        };

        return res.status(200).json({
            car,
            message: "Single Car Fetched Successfully"
        });

    } catch (error) {
        console.log("Get Car Error:", error.message);
        return res.status(500).json(
            {
                message: "Server error while fetching car",
                error: error.message
            }
        )
    }
};

// Get Car Filter Controller
export const getFilteredCars = async (req, res) => {
    try {
        console.log('Query params:', req.query);

        // Validate and parse pagination parameters
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
        const skip = (page - 1) * limit;

        // Build filter query
        const filter = buildCarQuery(req.query);
        console.log('Built filter:', JSON.stringify(filter, null, 2));

        // Validate and set sort parameters
        const allowedSortFields = ["price", "year", "mileage", "createdAt"];
        const sortField = allowedSortFields.includes(req.query.sort) ? req.query.sort : "createdAt";
        const sortOrder = req.query.order === "asc" ? 1 : -1; // Default to descending for most recent first
        const sort = { [sortField]: sortOrder };

        // Execute queries in parallel for better performance
        let cars, total;
        try {
            [cars, total] = await Promise.all([
                Car.find(filter)
                    .sort(sort)
                    .skip(skip)
                    .limit(limit)
                    .populate("postedBy", "name email")
                    .lean(),
                Car.countDocuments(filter)
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
            count: cars.length,
            total,
            page,
            pages,
            limit,
            hasNextPage,
            hasPreviousPage,
            data: cars,
            filters: Object.keys(req.query).length > 0 ? req.query : undefined
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
