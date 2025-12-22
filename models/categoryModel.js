import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        lowercase: true
    },
    description: {
        type: String,
        default: ""
    },
    image: {
        type: String,
        default: null
    },
    type: {
        type: String,
        enum: ["car", "blog", "location", "vehicle"],
        required: true
    },
    subType: {
        type: String,
        enum: ["make", "model", "year", "country", "city", "state", null],
        default: null
    },
    // Vehicle type for car categories (makes/models/years) - links to vehicle types like Car, Bus, Truck, etc.
    vehicleType: {
        type: String,
        enum: ["Car", "Bus", "Truck", "Van", "Bike", "E-bike", null],
        default: null,
        index: true
    },
    parentCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    order: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
}, {
    timestamps: true
});

categorySchema.index({ type: 1, isActive: 1 });
categorySchema.index({ type: 1, subType: 1, isActive: 1 });
categorySchema.index({ type: 1, subType: 1, vehicleType: 1, isActive: 1 }); // For filtering car categories by vehicle type
categorySchema.index({ parentCategory: 1 });

// Compound unique index: name + vehicleType + subType must be unique for car categories
// This allows same make name for different vehicle types (e.g., "Toyota" for Car and "Toyota" for Truck)
categorySchema.index(
    { name: 1, vehicleType: 1, subType: 1, type: 1 },
    { 
        unique: true,
        partialFilterExpression: { 
            type: "car",
            vehicleType: { $ne: null }
        }
    }
);

// Unique slug per vehicle type for car categories
categorySchema.index(
    { slug: 1, vehicleType: 1, type: 1 },
    { 
        unique: true,
        partialFilterExpression: { 
            type: "car",
            vehicleType: { $ne: null }
        }
    }
);

const Category = mongoose.model("Category", categorySchema);

export default Category;

