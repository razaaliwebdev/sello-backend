import Settings from "../models/settingsModel.js";
import { createAuditLog } from "../utils/auditLogger.js";
import Logger from "../utils/logger.js";

/**
 * Get All Settings
 */
export const getAllSettings = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view settings.",
      });
    }

    const { category } = req.query;

    const query = {};
    if (category) query.category = category;

    let settings = await Settings.find(query).sort({ category: 1, key: 1 });

    // If no settings exist, create default ones
    if (settings.length === 0) {
      const defaultSettings = [
        {
          key: "siteName",
          value: "Sello",
          type: "string",
          category: "general",
          description: "Site name",
        },
        {
          key: "contactEmail",
          value: "admin@sello.pk",
          type: "string",
          category: "general",
          description: "Contact email",
        },
        {
          key: "maxListingsPerDealer",
          value: 50,
          type: "number",
          category: "general",
          description: "Max listings per dealer",
        },
        {
          key: "commissionRate",
          value: 5,
          type: "number",
          category: "payment",
          description: "Commission rate",
        },
        {
          key: "allowRegistration",
          value: true,
          type: "boolean",
          category: "general",
          description: "Allow user registration",
        },
        {
          key: "requireEmailVerification",
          value: false,
          type: "boolean",
          category: "email",
          description: "Require email verification",
        },
        {
          key: "maintenanceMode",
          value: false,
          type: "boolean",
          category: "general",
          description: "Maintenance mode",
        },
        {
          key: "autoApproveDealers",
          value: false,
          type: "boolean",
          category: "general",
          description: "Auto approve dealers",
        },
        {
          key: "autoApproveListings",
          value: false,
          type: "boolean",
          category: "general",
          description: "Auto approve listings",
        },
        {
          key: "enableEmailNotifications",
          value: true,
          type: "boolean",
          category: "email",
          description: "Enable email notifications",
        },
        {
          key: "enablePushNotifications",
          value: true,
          type: "boolean",
          category: "general",
          description: "Enable push notifications",
        },
        {
          key: "paymentSystemEnabled",
          value: true,
          type: "boolean",
          category: "payment",
          description: "Payment system enabled",
        },
        {
          key: "showSubscriptionPlans",
          value: true,
          type: "boolean",
          category: "payment",
          description: "Show subscription plans",
        },
        {
          key: "showSubscriptionTab",
          value: true,
          type: "boolean",
          category: "payment",
          description: "Show subscription tab",
        },
        {
          key: "showPaymentHistory",
          value: true,
          type: "boolean",
          category: "payment",
          description: "Show payment history",
        },
        {
          key: "enableAutoRenewal",
          value: true,
          type: "boolean",
          category: "payment",
          description: "Enable auto renewal",
        },
        {
          key: "requirePaymentApproval",
          value: false,
          type: "boolean",
          category: "payment",
          description: "Require payment approval",
        },
      ];

      await Settings.insertMany(defaultSettings);
      settings = await Settings.find(query).sort({ category: 1, key: 1 });
    }

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
        flat: settings,
      },
    });
  } catch (error) {
    Logger.error("Get Settings Error", error, { userId: req.user?._id });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get Single Setting
 */
export const getSetting = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view settings.",
      });
    }

    const { key } = req.params;

    const setting = await Settings.findOne({ key });

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: "Setting not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Setting retrieved successfully.",
      data: setting,
    });
  } catch (error) {
    Logger.error("Get Setting Error", error, {
      userId: req.user?._id,
      key: req.params.key,
    });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Create or Update Setting
 */
export const upsertSetting = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update settings.",
      });
    }

    const { key, value, type, category, description } = req.body;

    if (!key) {
      return res.status(400).json({
        success: false,
        message: "Key is required.",
      });
    }

    // Validation rules for specific settings
    const validationRules = {
      siteName: {
        required: true,
        minLength: 2,
        maxLength: 100,
        type: "string",
      },
      contactEmail: {
        required: true,
        pattern: /^\S+@\S+\.\S+$/,
        maxLength: 255,
        type: "string",
      },
      maxListingsPerDealer: {
        required: false,
        min: 1,
        max: 10000,
        type: "number",
      },
      commissionRate: {
        required: false,
        min: 0,
        max: 100,
        type: "number",
      },
      siteLogo: {
        required: false,
        isUrl: true,
        type: "string",
      },
      businessLogo: {
        required: false,
        isUrl: true,
        type: "string",
      },
    };

    // Convert value based on type
    let processedValue = value;
    const valueType = type || "string";

    if (valueType === "boolean") {
      processedValue =
        value === true || value === "true" || value === 1 || value === "1";
    } else if (valueType === "number") {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return res.status(400).json({
          success: false,
          message: `Invalid number value for setting "${key}".`,
        });
      }
      processedValue = numValue;
    } else if (valueType === "object" && typeof value === "string") {
      try {
        processedValue = JSON.parse(value);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: `Invalid JSON value for setting "${key}".`,
        });
      }
    } else {
      processedValue = String(value);
    }

    // Apply validation rules if they exist for this key
    if (validationRules[key]) {
      const rule = validationRules[key];

      // Check required
      if (
        rule.required &&
        (!processedValue ||
          (typeof processedValue === "string" && !processedValue.trim()))
      ) {
        return res.status(400).json({
          success: false,
          message: `Setting "${key}" is required.`,
        });
      }

      // Type check
      if (rule.type && typeof processedValue !== rule.type) {
        return res.status(400).json({
          success: false,
          message: `Setting "${key}" must be of type ${rule.type}.`,
        });
      }

      // String validations
      if (rule.type === "string" && processedValue) {
        if (rule.minLength && processedValue.length < rule.minLength) {
          return res.status(400).json({
            success: false,
            message: `Setting "${key}" must be at least ${rule.minLength} characters.`,
          });
        }
        if (rule.maxLength && processedValue.length > rule.maxLength) {
          return res.status(400).json({
            success: false,
            message: `Setting "${key}" must be less than ${rule.maxLength} characters.`,
          });
        }
        if (rule.pattern && !rule.pattern.test(processedValue)) {
          return res.status(400).json({
            success: false,
            message: `Setting "${key}" has an invalid format.`,
          });
        }
        if (rule.isUrl) {
          try {
            new URL(processedValue);
          } catch (e) {
            return res.status(400).json({
              success: false,
              message: `Setting "${key}" must be a valid URL.`,
            });
          }
        }
      }

      // Number validations
      if (
        rule.type === "number" &&
        processedValue !== undefined &&
        processedValue !== null
      ) {
        if (rule.min !== undefined && processedValue < rule.min) {
          return res.status(400).json({
            success: false,
            message: `Setting "${key}" must be at least ${rule.min}.`,
          });
        }
        if (rule.max !== undefined && processedValue > rule.max) {
          return res.status(400).json({
            success: false,
            message: `Setting "${key}" cannot exceed ${rule.max}.`,
          });
        }
      }
    }

    const setting = await Settings.findOneAndUpdate(
      { key },
      {
        value: processedValue,
        type: valueType,
        category: category || "general",
        description: description || "",
        updatedBy: req.user._id,
      },
      {
        new: true,
        upsert: true,
      }
    );

    await createAuditLog(
      req.user,
      "setting_updated",
      {
        key,
        value,
        category,
      },
      null,
      req
    );

    return res.status(200).json({
      success: true,
      message: "Setting saved successfully.",
      data: setting,
    });
  } catch (error) {
    Logger.error("Upsert Setting Error", error, {
      userId: req.user?._id,
      key: req.body.key,
    });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Delete Setting
 */
export const deleteSetting = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete settings.",
      });
    }

    const { key } = req.params;

    const setting = await Settings.findOneAndDelete({ key });

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: "Setting not found.",
      });
    }

    await createAuditLog(
      req.user,
      "setting_deleted",
      {
        key,
      },
      null,
      req
    );

    return res.status(200).json({
      success: true,
      message: "Setting deleted successfully.",
    });
  } catch (error) {
    Logger.error("Delete Setting Error", error, {
      userId: req.user?._id,
      key: req.params.key,
    });
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
