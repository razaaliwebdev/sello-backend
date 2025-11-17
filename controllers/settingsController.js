import Settings from '../models/settingsModel.js';

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
        console.error("Get Settings Error:", error.message);
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
        console.error("Get Setting Error:", error.message);
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

        const setting = await Settings.findOneAndUpdate(
            { key },
            {
                value,
                type: type || "string",
                category: category || "general",
                description: description || "",
                updatedBy: req.user._id
            },
            {
                new: true,
                upsert: true
            }
        );

        return res.status(200).json({
            success: true,
            message: "Setting saved successfully.",
            data: setting
        });
    } catch (error) {
        console.error("Upsert Setting Error:", error.message);
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

        return res.status(200).json({
            success: true,
            message: "Setting deleted successfully."
        });
    } catch (error) {
        console.error("Delete Setting Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

