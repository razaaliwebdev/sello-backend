import mongoose from "mongoose";
import Car from "../models/carModel.js";
import { buildCarQuery } from '../utils/buildCarQuery.js';




// Create Car Controller
export const createCar = async (req, res) => {
    try {
        const {
            make, model, variant, year, condition,
            price, colorExterior, colorInterior, fuelType, engineCapacity,
            transmission, mileage, features, city, location, sellerType,
            carDoors, contactNumber, geoLocation, horsepower, warranty
        } = req.body;

        // Validation
        if (!make || !model || !year || !condition || !price || !city || !contactNumber) {
            return res.status(400).json({
                message: "Please fill all the required fields: make, model, year, condition, price, city, contactNumber"
            });
        }

        if (!["used", "new"].includes(condition)) {
            return res.status(400).json({
                message: "Invalid condition value. Must be 'new' or 'used'."
            });
        }

        // ✅ Handle Image Uploads via Multer (Cloudinary returns .path as URL)
        let imageUrls = [];

        if (req.files && req.files.length > 0) {
            imageUrls = req.files.map((file) => file.path);
        } else {
            return res.status(400).json({
                message: "At least one image is required."
            });
        }

        // ✅ Create new car listing
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
            postedBy: req.user._id
        });

        return res.status(201).json({
            message: "Car created successfully.",
            car: newCar
        });

    } catch (error) {
        console.log("Create Car Error:", error.message);
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
        const cars = await Car.findOne({ postedBy: req.user._id }).sort({ created: -1 });

        return res.status(200).json({
            message: "My Cars Fetched Successfully.",
            total: cars.length,
            cars
        })
    } catch (error) {
        console.log("My Cars Errors:", error.messages);
        return res.status(500).json({
            message: 'Failed to get user cars',
            error: error.message
        });
    }
};


// Get All Cars Controller
export const getAllCars = async (req, res) => {
    try {
        const cars = await Car.find().populate("postedBy", "name email role");

        if (!cars || cars.length === 0) {
            return res.status(200).json({
                message: "No cars found.",
                total: 0,
                cars: []
            });
        }

        return res.status(200).json({
            message: "Fetched all the cars.",
            total: cars.length,
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

        const filter = buildCarQuery(req.query);

        const page = parseIn(req.query.page) || 1;
        const limit = parseIn(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        const sort = req.query.sort
            ? {
                [req.query.sort]: req.query.order === "desc" ? -1 : 1
            }
            :
            {
                createdAt: -1
            };

        const cars = await Car.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate("postedBy", "name email");

        const total = await Car.countDocuments(filter);

        return res.status(200).json({
            count: cars.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            data: cars
        });

    } catch (error) {
        console.log("Get Filtered Cars Error", error.message);
        return res.status(500).json({
            message: "Sever error while fetching cars"
        })
    }
};
