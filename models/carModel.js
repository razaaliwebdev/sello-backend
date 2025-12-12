import mongoose from "mongoose";

const carSchema = new mongoose.Schema(
    {
        postedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // name of the User model
            required: true,
        },
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
        fuelType: {
            type: String,
            required: true,
            enum: ["Petrol", "Diesel", "Hybrid", "Electric"],
        },
        engineCapacity: {
            type: Number,
            required: false, // Handled dynamically in controller
            min: 0,
        },
        transmission: { type: String, required: true, enum: ["Manual", "Automatic"] },
        mileage: { type: Number, default: 0 },
        features: {
            type: [String],
            default: [],
            validate: {
                // Ensure all features are non-empty strings
                validator: (arr) =>
                    Array.isArray(arr) &&
                    arr.every((f) => f && typeof f === "string" && f.trim().length > 0),
                message: "Features must be non-empty strings",
            },
        },
        regionalSpec: {
            type: String,
            required: true,
            enum: ["GCC", "American", "Canadian", "European"],
        },
        // Vehicle Type Category (Car, Bus, Truck, Van, Bike, E-bike)
        vehicleType: {
            type: String,
            required: true,
            enum: ["Car", "Bus", "Truck", "Van", "Bike", "E-bike"],
            default: "Car",
            index: true,
        },
        // Reference to Category for vehicle type
        vehicleTypeCategory: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            default: null,
        },
        bodyType: {
            type: String,
            required: false, // Handled dynamically in controller
            enum: [
                "Roadster",
                "Cabriolet",
                "Super",
                "Hatchback",
                "Micro",
                "Station",
                "Sedan",
                "Muscle",
                "Sports",
                "Targa",
                "Convertible",
                "Coupe",
                "Hybrid",
                "SUV",
                "Pickup",
                "Van",
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
                    // [longitude, latitude]
                    validator: (coords) => {
                        if (!Array.isArray(coords) || coords.length !== 2) return false;
                        const [long, lat] = coords;
                        return (
                            typeof long === "number" &&
                            typeof lat === "number" &&
                            long >= -180 &&
                            long <= 180 &&
                            lat >= -90 &&
                            lat <= 90
                        );
                    },
                    message:
                        "Invalid coordinates: longitude (-180 to 180), latitude (-90 to 90)",
                },
            },
        },
        horsepower: {
            type: Number,
            default: 0,
            min: 0,
        },
        warranty: { type: String, required: true, enum: ["Yes", "No", "Doesn't Apply"] },
        numberOfCylinders: { type: Number, default: 4, max: 16 },
        ownerType: { type: String, required: true, enum: ["Owner", "Dealer", "Dealership"] },
        // E-bike specific fields
        batteryRange: {
            type: Number,
            default: null,
            min: 0,
        },
        motorPower: {
            type: Number,
            default: null,
            min: 0,
        },
        images: [{ type: String }],

        // Legacy sold flags (kept for backwards compatibility)
        isSold: {
            type: Boolean,
            default: false,
            index: true,
        },
        soldAt: {
            type: Date,
            default: null,
        },

        // New status lifecycle fields
        status: {
            type: String,
            enum: ["active", "sold", "expired", "deleted"],
            default: "active",
            index: true,
        },
        soldDate: {
            type: Date,
            default: null,
        },
        autoDeleteDate: {
            type: Date,
            default: null,
            index: true,
        },
        isAutoDeleted: {
            type: Boolean,
            default: false,
            index: true,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        // Boost Post Fields
        isBoosted: {
            type: Boolean,
            default: false,
        },
        boostExpiry: {
            type: Date,
            default: null,
        },
        boostPriority: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        boostHistory: [
            {
                boostedAt: { type: Date, default: Date.now },
                boostedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                boostType: { type: String, enum: ["user", "admin"], default: "user" },
                duration: { type: Number }, // in days
                expiredAt: { type: Date },
            },
        ],

        // Admin Management Fields
        isApproved: {
            type: Boolean,
            default: true, // Auto-approve, admin can reject
            index: true,
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        approvedAt: {
            type: Date,
            default: null,
        },
        rejectionReason: {
            type: String,
            default: null,
        },
        views: {
            type: Number,
            default: 0,
        },
        featured: {
            type: Boolean,
            default: false,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for better query performance
carSchema.index({ geoLocation: "2dsphere" });
carSchema.index({ isBoosted: 1, boostExpiry: 1 });
carSchema.index({ isApproved: 1, isBoosted: 1, boostPriority: -1, createdAt: -1 });
carSchema.index({ postedBy: 1 });
carSchema.index({ featured: 1, isBoosted: 1 });
carSchema.index({ isSold: 1, isApproved: 1 });
carSchema.index({ status: 1, autoDeleteDate: 1, isAutoDeleted: 1 });
carSchema.index({ vehicleType: 1, status: 1, isApproved: 1 });
carSchema.index({ vehicleTypeCategory: 1, status: 1, isApproved: 1 });
// Text search indexes for keyword search
carSchema.index({ title: "text", make: "text", model: "text", description: "text" });
// Numeric indexes for range queries
carSchema.index({ horsepower: 1 });
carSchema.index({ engineCapacity: 1 });
carSchema.index({ batteryRange: 1 });
carSchema.index({ motorPower: 1 });
carSchema.index({ price: 1 });
carSchema.index({ year: 1 });
carSchema.index({ mileage: 1 });

const Car = mongoose.model("Car", carSchema);

export default Car;


