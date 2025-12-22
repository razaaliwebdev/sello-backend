/**
 * Category Field Model
 * Defines the dynamic fields for each vehicle type
 */
import mongoose from 'mongoose';

const categoryFieldSchema = new mongoose.Schema({
    vehicleType: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VehicleType',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    label: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['text', 'number', 'select', 'multiselect', 'checkbox', 'date', 'textarea', 'radio'],
        required: true
    },
    required: {
        type: Boolean,
        default: false
    },
    order: {
        type: Number,
        default: 0
    },
    // If options are static or fetched from a specific source/endpoint
    // format: "static:Option1,Option2" or "ref:ModelName" or "custom:handlerName"
    optionsSource: {
        type: String,
        default: null
    },
    options: [{
        label: String,
        value: String
    }],
    // For UI dependencies, e.g. { field: "brand", value: "Toyota" } -> show only if brand is Toyota
    // Or { field: "brand", value: null } -> show if brand has any value
    dependency: {
        field: { type: String },
        value: { type: mongoose.Schema.Types.Mixed }
    },
    placeholder: {
        type: String
    },
    validationRules: {
        min: Number,
        max: Number,
        regex: String
    }
}, {
    timestamps: true
});

// Compound index to ensure unique field names per vehicle type
categoryFieldSchema.index({ vehicleType: 1, name: 1 }, { unique: true });

const CategoryField = mongoose.model('CategoryField', categoryFieldSchema);

export default CategoryField;
