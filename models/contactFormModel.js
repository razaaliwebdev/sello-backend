import mongoose from 'mongoose';

const contactFormSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ["new", "in_progress", "resolved"],
        default: "new"
    },
    chatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Chat",
        default: null
    },
    resolvedAt: {
        type: Date,
        default: null
    },
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    notes: {
        type: String,
        default: ""
    }
}, {
    timestamps: true
});

contactFormSchema.index({ status: 1, createdAt: -1 });
contactFormSchema.index({ email: 1 });
contactFormSchema.index({ chatId: 1 });

const ContactForm = mongoose.model("ContactForm", contactFormSchema);

export default ContactForm;

