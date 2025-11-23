import mongoose from 'mongoose';

const testimonialSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        default: "",
        trim: true
    },
    company: {
        type: String,
        default: "",
        trim: true
    },
    image: {
        type: String,
        default: null
    },
    text: {
        type: String,
        required: true,
        trim: true
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        default: 5
    },
    isActive: {
        type: Boolean,
        default: true
    },
    order: {
        type: Number,
        default: 0
    },
    featured: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, {
    timestamps: true
});

testimonialSchema.index({ isActive: 1, featured: 1, order: 1 });

const Testimonial = mongoose.model("Testimonial", testimonialSchema);

export default Testimonial;

