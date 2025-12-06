import mongoose from "mongoose";
import Car from "../models/carModel.js";
import User from "../models/userModel.js";

// Schema for Reports (Internal use, or could be a model)
const reportSchema = new mongoose.Schema({
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: ["Car", "User"], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    reason: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: ["pending", "resolved", "dismissed"], default: "pending" }
}, { timestamps: true });

const Report = mongoose.model("Report", reportSchema);

export const createReport = async (req, res) => {
    try {
        const { targetType, targetId, reason, description } = req.body;

        if (!["Car", "User"].includes(targetType)) {
            return res.status(400).json({ message: "Invalid target type" });
        }

        // Verify target exists
        if (targetType === "Car") {
            const car = await Car.findById(targetId);
            if (!car) return res.status(404).json({ message: "Car not found" });
        } else {
            const user = await User.findById(targetId);
            if (!user) return res.status(404).json({ message: "User not found" });
        }

        const report = await Report.create({
            reporter: req.user._id,
            targetType,
            targetId,
            reason,
            description
        });

        return res.status(201).json({
            success: true,
            message: "Report submitted successfully",
            data: report
        });

    } catch (error) {
        console.error("Create Report Error:", error);
        return res.status(500).json({ message: "Server error submitting report" });
    }
};

export const getReports = async (req, res) => {
    try {
        const reports = await Report.find()
            .populate("reporter", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, data: reports });
    } catch (error) {
        return res.status(500).json({ message: "Server error fetching reports" });
    }
};

export default Report;
