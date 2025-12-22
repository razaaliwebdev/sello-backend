/**
 * Vehicle Type Model
 * Stores different types of vehicles (Car, Bike, Truck, etc.)
 */
import mongoose from 'mongoose';

const vehicleTypeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    slug: {
        type: String,
        unique: true,
        trim: true,
        lowercase: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Middleware to auto-generate slug from name if not provided
vehicleTypeSchema.pre('save', function (next) {
    if (this.isModified('name') && !this.slug) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    next();
});

const VehicleType = mongoose.model('VehicleType', vehicleTypeSchema);

export default VehicleType;
