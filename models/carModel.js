
import mongoose from "mongoose";

const carSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: "" },
    make: { type: String, required: true },
    model: { type: String, required: true },
    variant: { type: String, default: "N/A" },
    year: { type: Number, required: true },
    condition: { type: String, required: true, enum: ["New", "Used"] },
    price: { type: Number, required: true },
    colorExterior: { type: String, default: "N/A" },
    colorInterior: { type: String, default: "N/A" },
    fuelType: { type: String, required: true, enum: ["Petrol", "Diesel", "Hybrid", "Electric"] },
    engineCapacity: {
        type: String,
        required: true,
        enum: ["0-999 CC", "1000-1499 CC", "1500-1999 CC", "2000-2499 CC", "2500+ CC"],
    },
    transmission: { type: String, required: true, enum: ["Manual", "Automatic"] },
    mileage: { type: Number, default: 0 },
    features: {
        type: [String],
        default: [],
        validate: {
            validator: (arr) => arr.every((f) => f && typeof f === "string" && f.trim().length > 0),
            message: "Features must be non-empty strings",
        },
    },
    regionalSpec: { type: String, required: true, enum: ["GCC", "American", "Canadian", "European"] },
    bodyType: {
        type: String,
        required: true,
        enum: [
            "Roadster", "Cabriolet", "Super", "Hatchback", "Micro", "Station", "Sedan",
            "Muscle", "Sports", "Targa", "Convertible", "Coupe", "Hybrid", "SUV", "Pickup", "Van",
        ],
    },
    city: { type: String, required: true },
    location: { type: String, default: "" },
    sellerType: { type: String, required: true, enum: ["individual", "dealer"] },
    carDoors: { type: Number, default: 4 },
    contactNumber: {
        type: String,
        required: true,
        validate: {
            validator: (v) => /^\+?\d{9,15}$/.test(v),
            message: "Contact number must be 9-15 digits",
        },
    },
    geoLocation: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point",
        },
        coordinates: {
            type: [Number],
            required: true,
            validate: {
                validator: ([long, lat]) => long >= -180 && long <= 180 && lat >= -90 && lat <= 90,
                message: "Invalid coordinates: longitude (-180 to 180), latitude (-90 to 90)",
            },
        },
    },
    horsepower: {
        type: String,
        default: "N/A",
        validate: {
            validator: (v) => v === "N/A" || /^\d+\s*HP$/.test(v),
            message: "Horsepower must be in format 'X HP' or 'N/A'",
        },
    },
    warranty: { type: String, required: true, enum: ["Yes", "No", "Doesn't Apply"] },
    numberOfCylinders: { type: Number, default: 4, max: 16 },
    ownerType: { type: String, required: true, enum: ["Owner", "Dealer", "Dealership"] },
    images: [{ type: String }],
});

carSchema.index({ geoLocation: "2dsphere" });

const Car = mongoose.model("Car", carSchema);

export default Car;

