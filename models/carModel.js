import mongoose from "mongoose";
import User from './userModel.js';

const carSchema = new mongoose.Schema(
    {
        images: {
            type: [String],
            default: [],
        },

        // Make & Model
        make: {
            type: String,
            required: true,
            index: true,
            trim: true,
        },
        model: {
            type: String,
            required: true,
            index: true,
            trim: true,
        },
        variant: {
            type: String,
            trim: true,
            default: "N/A",
        },

        // Specs
        year: {
            type: Number,
            required: true,
            index: true,
            min: 1950,
        },
        condition: {
            type: String,
            required: true,
            enum: ["new", "used"],
        },
        price: {
            type: Number,
            required: true,
            index: true,
            min: 0,
        },

        // Colors
        colorExterior: {
            type: String,
            trim: true,
            default: "N/A",
        },
        colorInterior: {
            type: String,
            trim: true,
            default: "N/A",
        },

        // Engine & Transmission
        fuelType: {
            type: String,
            enum: ["petrol", "diesel", "hybrid", "electric", "cng"],
        },
        engineCapacity: {
            type: Number,
            min: 0,
        },
        transmission: {
            type: String,
            enum: ["auto", "manual", "hybird", "electric"],
        },

        mileage: {
            type: Number,
            min: 0,
        },

        features: {
            type: [String],
            default: [],
        },
        regionalSpec: {
            type: String,
            enum: ["GCC", "American", "Canadian", "European"],
        },
        bodyType: {
            type: String,
            enum: ["Roadster", "Cabriolet", "Super", "Micro", "Station", "Muscle", "Sports", "Targa", "Sedan", "SUV", "Hatchback", "Coupe", "Convertible", "Pickup"],
        },
        // Location
        city: {
            type: String,
            required: true,
            index: true,
            trim: true,
        },
        location: {
            type: String,
            trim: true,
            default: "",
        },

        // Seller Info
        sellerType: {
            type: String,
            enum: ["individual", "dealer"],
        },
        carDoors: {
            type: Number,
            min: 2,
            max: 6,
        },
        contactNumber: {
            type: String,
            required: true,
            trim: true,
        },
        postedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // Optional: GeoLocation for "Cars Near Me" feature
        geoLocation: {
            type: {
                type: String,
                enum: ["Point"],
                default: "Point",
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                default: [0, 0],
            },
        },
        // New: warranty field
        warranty: {
            type: String,
            enum: ["yes", "no", "does not apply"],
            required: true
        },
        // New: horsepower field
        horsepower: {
            type: Number,
            min: 0,
            required: true
        },
        numberOfCylinders: {
            type: Number,
            min: 1,
            max: 16
        },
        ownerType: {
            type: String,
            enum: ["owner", "dealer", "Dealership/certified Pre-Owned"]
        }
    },
    {
        timestamps: true,
    }
);

// Index for geospatial queries (optional)
carSchema.index({ geoLocation: "2dsphere" });

const Car = mongoose.model("Car", carSchema);

export default Car;





// Basic Info
// title: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 100,
// },
// description: {
//     type: String,
//     trim: true,
//     maxlength: 1000,
// },