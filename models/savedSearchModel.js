import mongoose from 'mongoose';

const savedSearchSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
        // Note: Index defined below to avoid duplicates
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    // Search criteria - stores the filter parameters
    searchCriteria: {
        // Text search
        search: { type: String, default: null },
        
        // Vehicle filters
        vehicleType: { type: [String], default: [] },
        vehicleTypeCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
        make: { type: String, default: null },
        model: { type: String, default: null },
        yearMin: { type: Number, default: null },
        yearMax: { type: Number, default: null },
        condition: { type: [String], default: [] },
        
        // Price range
        priceMin: { type: Number, default: null },
        priceMax: { type: Number, default: null },
        
        // Technical filters
        fuelType: { type: [String], default: [] },
        transmission: { type: [String], default: [] },
        bodyType: { type: [String], default: [] },
        regionalSpec: { type: [String], default: [] },
        mileageMin: { type: Number, default: null },
        mileageMax: { type: Number, default: null },
        
        // Location
        city: { type: String, default: null },
        country: { type: String, default: null },
        radius: { type: Number, default: null },
        userLat: { type: Number, default: null },
        userLng: { type: Number, default: null },
        
        // Additional filters
        ownerType: { type: [String], default: [] },
        warranty: { type: [String], default: [] },
        features: { type: [String], default: [] }
    },
    // Alert settings
    emailAlerts: {
        type: Boolean,
        default: true
    },
    alertFrequency: {
        type: String,
        enum: ['instant', 'daily', 'weekly'],
        default: 'daily'
    },
    lastAlertSent: {
        type: Date,
        default: null
    },
    // Count of new listings found since last alert
    newListingsCount: {
        type: Number,
        default: 0
    },
    // Track last time search was executed
    lastExecutedAt: {
        type: Date,
        default: Date.now
    },
    // Active status
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
savedSearchSchema.index({ user: 1, isActive: 1 });
savedSearchSchema.index({ 'emailAlerts': 1, 'alertFrequency': 1, 'isActive': 1 });
savedSearchSchema.index({ lastAlertSent: 1 });

const SavedSearch = mongoose.model('SavedSearch', savedSearchSchema);

export default SavedSearch;
