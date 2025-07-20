import mongoose from 'mongoose';
import Car from '../models/carModel.js';

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true,
            unique: true
        },
        password: {
            type: String,
            required: true
        },
        otp: {
            type: String
        },
        otpExpiry: {
            type: Date
        },
        verified: {
            type: Boolean,
            default: false
        },
        role: {
            type: String,
            enum: ["buyer", "seller", "admin"],
            default: "buyer"
        },
        avatar: {
            type: String,
            required: false
        },
        // 🚗 Cars posted by user (as seller)
        carsPosted: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Car"
            }
        ],
        // 🚗 Cars bought by user (as buyer)
        carsPurchased: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Car"
            }
        ]
    },
    {
        timestamps: true
    }
);

const User = mongoose.model("User", userSchema);

export default User;
