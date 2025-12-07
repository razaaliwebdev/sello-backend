import Car from "../models/carModel.js";
import User from "../models/userModel.js";
import Report from "../models/reportModel.js";
import Logger from "../utils/logger.js";
import { AppError, asyncHandler } from "../middlewares/errorHandler.js";

export const createReport = asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new AppError("Authentication required", 401);
    }

    const { targetType, targetId, reason, description } = req.body;

    // Validate required fields
    if (!targetType || !targetId || !reason) {
        throw new AppError("targetType, targetId, and reason are required", 400);
    }

    if (!["Car", "User", "Review", "Chat"].includes(targetType)) {
        throw new AppError("Invalid target type. Must be Car, User, Review, or Chat", 400);
    }

    // Check if user already reported this
    const existingReport = await Report.findOne({
        reporter: req.user._id,
        targetType,
        targetId
    });

    if (existingReport) {
        throw new AppError("You have already reported this item", 400);
    }

    // Verify target exists
    if (targetType === "Car") {
        const car = await Car.findById(targetId);
        if (!car) throw new AppError("Car not found", 404);
    } else if (targetType === "User") {
        const user = await User.findById(targetId);
        if (!user) throw new AppError("User not found", 404);
        
        // Prevent self-reporting
        if (targetId.toString() === req.user._id.toString()) {
            throw new AppError("You cannot report yourself", 400);
        }
    }

    const report = await Report.create({
        reporter: req.user._id,
        targetType,
        targetId,
        reason,
        description: description || ""
    });

    Logger.info("Report created", {
        reportId: report._id,
        reporter: req.user._id,
        targetType,
        targetId
    });

    return res.status(201).json({
        success: true,
        message: "Report submitted successfully. Our team will review it shortly.",
        data: report
    });
});

export const getReports = asyncHandler(async (req, res) => {
    // Only admins can view all reports
    if (req.user?.role !== 'admin') {
        throw new AppError("Access denied. Admin privileges required", 403);
    }

    const { status, targetType, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (targetType) query.targetType = targetType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reports = await Report.find(query)
        .populate("reporter", "name email avatar")
        .populate("reviewedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Report.countDocuments(query);

    return res.status(200).json({ 
        success: true, 
        data: reports,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

export const updateReportStatus = asyncHandler(async (req, res) => {
    if (req.user?.role !== 'admin') {
        throw new AppError("Access denied. Admin privileges required", 403);
    }

    const { reportId } = req.params;
    const { status, adminNotes } = req.body;

    if (!["pending", "reviewing", "resolved", "dismissed"].includes(status)) {
        throw new AppError("Invalid status", 400);
    }

    const report = await Report.findById(reportId);
    if (!report) {
        throw new AppError("Report not found", 404);
    }

    report.status = status;
    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();
    if (adminNotes) report.adminNotes = adminNotes;

    await report.save();

    Logger.info("Report status updated", {
        reportId,
        status,
        reviewedBy: req.user._id
    });

    return res.status(200).json({
        success: true,
        message: "Report status updated",
        data: report
    });
});
