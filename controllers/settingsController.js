import Settings from '../models/settingsModel.js';
import { createAuditLog } from '../utils/auditLogger.js';
import Logger from '../utils/logger.js';

/**
 * Get All Settings
 */
export const getAllSettings = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view settings."
            });
        }

        const { category } = req.query;

        const query = {};
        if (category) query.category = category;

        const settings = await Settings.find(query).sort({ category: 1, key: 1 });

        // Group by category
        const grouped = settings.reduce((acc, setting) => {
            if (!acc[setting.category]) {
                acc[setting.category] = [];
            }
            acc[setting.category].push(setting);
            return acc;
        }, {});

        return res.status(200).json({
            success: true,
            message: "Settings retrieved successfully.",
            data: {
                settings: grouped,
                flat: settings
            }
        });
    } catch (error) {
        Logger.error("Get Settings Error", error, { userId: req.user?._id });
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get Single Setting
 */
export const getSetting = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can view settings."
            });
        }

        const { key } = req.params;

        const setting = await Settings.findOne({ key });

        if (!setting) {
            return res.status(404).json({
                success: false,
                message: "Setting not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Setting retrieved successfully.",
            data: setting
        });
    } catch (error) {
        Logger.error("Get Setting Error", error, { userId: req.user?._id, key: req.params.key });
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Create or Update Setting
 */
export const upsertSetting = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can update settings."
            });
        }

        const { key, value, type, category, description } = req.body;

        if (!key) {
            return res.status(400).json({
                success: false,
                message: "Key is required."
            });
        }

        // Convert value based on type
        let processedValue = value;
        const valueType = type || "string";
        
        if (valueType === "boolean") {
            processedValue = value === true || value === "true" || value === 1 || value === "1";
        } else if (valueType === "number") {
            processedValue = Number(value) || 0;
        } else if (valueType === "object" && typeof value === "string") {
            try {
                processedValue = JSON.parse(value);
            } catch (e) {
                processedValue = value;
            }
        } else {
            processedValue = String(value);
        }

        const setting = await Settings.findOneAndUpdate(
            { key },
            {
                value: processedValue,
                type: valueType,
                category: category || "general",
                description: description || "",
                updatedBy: req.user._id
            },
            {
                new: true,
                upsert: true
            }
        );

        await createAuditLog(req.user, "setting_updated", {
            key,
            value,
            category
        }, null, req);

        return res.status(200).json({
            success: true,
            message: "Setting saved successfully.",
            data: setting
        });
    } catch (error) {
        Logger.error("Upsert Setting Error", error, { userId: req.user?._id, key: req.body.key });
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete Setting
 */
export const deleteSetting = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admins can delete settings."
            });
        }

        const { key } = req.params;

        const setting = await Settings.findOneAndDelete({ key });

        if (!setting) {
            return res.status(404).json({
                success: false,
                message: "Setting not found."
            });
        }

        await createAuditLog(req.user, "setting_deleted", {
            key
        }, null, req);

        return res.status(200).json({
            success: true,
            message: "Setting deleted successfully."
        });
    } catch (error) {
        Logger.error("Delete Setting Error", error, { userId: req.user?._id, key: req.params.key });
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

