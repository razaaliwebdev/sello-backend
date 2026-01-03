import Category from "../models/categoryModel.js";
import mongoose from "mongoose";
import { uploadCloudinary } from "../utils/cloudinary.js";
import Logger from "../utils/logger.js";

/**
 * Create Category
 */
export const createCategory = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can create categories.",
      });
    }

    const {
      name,
      description,
      image,
      type,
      subType,
      parentCategory,
      order,
      isActive,
      vehicleType,
    } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        success: false,
        message: "Name and type are required.",
      });
    }

    // Handle image upload
    let imageUrl = image || null;
    if (req.file) {
      try {
        imageUrl = await uploadCloudinary(req.file.buffer);
      } catch (error) {
        Logger.error("Error uploading category image", error);
        return res.status(500).json({
          success: false,
          message: "Failed to upload image.",
        });
      }
    }

    // Validate subType for car categories
    if (
      type === "car" &&
      subType &&
      !["make", "model", "year"].includes(subType)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid subType for car category. Must be 'make', 'model', or 'year'.",
      });
    }

    // Validate vehicleType for car categories (but not for years - years are independent)
    if (type === "car" && subType && ["make", "model"].includes(subType)) {
      const validVehicleTypes = [
        "Car",
        "Bus",
        "Truck",
        "Van",
        "Bike",
        "E-bike",
      ];
      if (!vehicleType || !validVehicleTypes.includes(vehicleType)) {
        return res.status(400).json({
          success: false,
          message: `vehicleType is required for car categories. Must be one of: ${validVehicleTypes.join(
            ", "
          )}`,
        });
      }
    }

    // Validate subType for location categories
    if (
      type === "location" &&
      subType &&
      !["country", "city", "state"].includes(subType)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid subType for location category. Must be 'country', 'city', or 'state'.",
      });
    }

    // Cities and states require a parentCategory
    if (
      type === "location" &&
      (subType === "city" || subType === "state") &&
      !parentCategory
    ) {
      if (subType === "city") {
        return res.status(400).json({
          success: false,
          message: "City categories must have a state category as parent.",
        });
      } else if (subType === "state") {
        return res.status(400).json({
          success: false,
          message: "State categories must have a country category as parent.",
        });
      }
    }

    // Validate parentCategory if provided
    if (parentCategory) {
      if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
        return res.status(400).json({
          success: false,
          message: "Invalid parent category ID.",
        });
      }
      const parent = await Category.findById(parentCategory);
      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "Parent category not found.",
        });
      }

      // Ensure parent is a location type category
      if (type === "location" && parent.type !== "location") {
        return res.status(400).json({
          success: false,
          message: `Parent category must be a location type category. Received type: "${parent.type}"`,
        });
      }

      // IMPORTANT: Cities depend ONLY on State, NOT on Country
      // Cities must have a state as parent (not country)
      // This validation MUST come FIRST and we skip all other validations for cities
      if (subType === "city") {
        if (parent.subType !== "state") {
          if (parent.subType === "country") {
            return res.status(400).json({
              success: false,
              message:
                "City categories must have a state category as parent, not a country. Please select a state.",
            });
          }
          return res.status(400).json({
            success: false,
            message: `City categories must have a state category as parent. Received parent type: "${parent.subType}"`,
          });
        }
        // CRITICAL: For cities, we ONLY check that parent is a state.
        // We do NOT check if the state has a country parent - that's not our concern.
        // Skip all other validations for cities.
      } else if (subType === "state") {
        // States must have a country as parent
        if (parent.subType !== "country") {
          return res.status(400).json({
            success: false,
            message: "State categories must have a country category as parent.",
          });
        }
      } else if (subType === "model") {
        // Models must have a make as parent
        if (parent.subType !== "make") {
          return res.status(400).json({
            success: false,
            message: "Model categories must have a make category as parent.",
          });
        }
        // Ensure parent make has the same vehicleType
        if (vehicleType && parent.vehicleType !== vehicleType) {
          return res.status(400).json({
            success: false,
            message: `Model vehicle type (${vehicleType}) must match parent brand vehicle type (${
              parent.vehicleType || "none"
            }).`,
          });
        }
      }
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Check if category already exists (considering type, subType, vehicleType, and parent)
    // Use name instead of slug for better duplicate detection
    const query = { name: name.trim(), type };
    if (subType) query.subType = subType;
    if (vehicleType) query.vehicleType = vehicleType;
    if (parentCategory) query.parentCategory = parentCategory;

    const existingCategory = await Category.findOne(query);
    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: `Category "${name.trim()}" already exists${
          vehicleType ? ` for ${vehicleType}` : ""
        }.`,
      });
    }

    const category = await Category.create({
      name: name.trim(),
      slug,
      description: description || "",
      image: imageUrl,
      type,
      subType: subType || null,
      vehicleType: type === "car" && vehicleType ? vehicleType : null,
      parentCategory: parentCategory || null,
      order: order || 0,
      isActive:
        isActive !== undefined
          ? isActive === "true" || isActive === true
          : true,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully.",
      data: category,
    });
  } catch (error) {
    Logger.error("Create Category Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get All Categories
 */
export const getAllCategories = async (req, res) => {
  try {
    const { type, subType, parentCategory, isActive, vehicleType } = req.query;

    const query = {};
    if (type) query.type = type;
    if (subType) query.subType = subType;
    if (parentCategory) query.parentCategory = parentCategory;
    if (isActive !== undefined) query.isActive = isActive === "true";
    if (vehicleType) query.vehicleType = vehicleType;

    const categories = await Category.find(query)
      .populate("createdBy", "name email")
      .populate("parentCategory", "name slug vehicleType")
      .sort({ order: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Categories retrieved successfully.",
      data: categories,
    });
  } catch (error) {
    Logger.error("Get All Categories Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get Single Category
 */
export const getCategoryById = async (req, res) => {
  try {
    const { categoryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID.",
      });
    }

    const category = await Category.findById(categoryId).populate(
      "createdBy",
      "name email"
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category retrieved successfully.",
      data: category,
    });
  } catch (error) {
    Logger.error("Get Category Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update Category
 */
export const updateCategory = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update categories.",
      });
    }

    const { categoryId } = req.params;
    const {
      name,
      description,
      image,
      subType,
      parentCategory,
      isActive,
      order,
      vehicleType,
    } = req.body;

    // Handle image upload if new file is provided
    let imageUrl = image;
    if (req.file) {
      try {
        imageUrl = await uploadCloudinary(req.file.buffer);
      } catch (error) {
        Logger.error("Error uploading category image", error);
        return res.status(500).json({
          success: false,
          message: "Failed to upload image.",
        });
      }
    } else if (image !== undefined) {
      // If image is explicitly set (even if null), use it
      imageUrl = image;
    }

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID.",
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    // Update fields
    if (name !== undefined && name !== null) {
      category.name = name.trim();
      category.slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }
    if (description !== undefined) category.description = description;
    if (imageUrl !== undefined) category.image = imageUrl;
    if (isActive !== undefined) {
      category.isActive = isActive === "true" || isActive === true;
    }
    if (subType !== undefined) {
      if (
        category.type === "car" &&
        subType &&
        !["make", "model", "year"].includes(subType)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid subType for car category.",
        });
      }
      if (
        category.type === "location" &&
        subType &&
        !["country", "city", "state"].includes(subType)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid subType for location category.",
        });
      }
      category.subType = subType;
    }
    if (vehicleType !== undefined && category.type === "car") {
      // Only validate vehicleType for make and model, not for years (years are independent)
      if (category.subType && ["make", "model"].includes(category.subType)) {
        const validVehicleTypes = [
          "Car",
          "Bus",
          "Truck",
          "Van",
          "Bike",
          "E-bike",
        ];
        if (vehicleType && !validVehicleTypes.includes(vehicleType)) {
          return res.status(400).json({
            success: false,
            message: `Invalid vehicleType. Must be one of: ${validVehicleTypes.join(
              ", "
            )}`,
          });
        }
        category.vehicleType = vehicleType || null;
      }
      // For years, don't set vehicleType (keep it null/undefined)
    }
    if (parentCategory !== undefined) {
      if (parentCategory && !mongoose.Types.ObjectId.isValid(parentCategory)) {
        return res.status(400).json({
          success: false,
          message: "Invalid parent category ID.",
        });
      }

      if (parentCategory) {
        const parent = await Category.findById(parentCategory);
        if (!parent) {
          return res.status(404).json({
            success: false,
            message: "Parent category not found.",
          });
        }

        // Use the updated subType if it was provided, otherwise use the existing one
        const currentSubType =
          subType !== undefined ? subType : category.subType;

        // IMPORTANT: Cities depend ONLY on State, NOT on Country
        // Cities must have a state as parent (not country)
        // This validation MUST come FIRST and use else-if to prevent any confusion
        if (category.type === "location" && currentSubType === "city") {
          if (parent.subType !== "state") {
            if (parent.subType === "country") {
              return res.status(400).json({
                success: false,
                message:
                  "City categories must have a state category as parent, not a country. Please select a state.",
              });
            }
            return res.status(400).json({
              success: false,
              message: `City categories must have a state category as parent. Received parent type: "${parent.subType}"`,
            });
          }
          // City validation passed, no need to check anything else
        } else if (category.type === "location" && currentSubType === "state") {
          // States must have a country as parent
          if (parent.subType !== "country") {
            return res.status(400).json({
              success: false,
              message:
                "State categories must have a country category as parent.",
            });
          }
        } else if (category.type === "car" && currentSubType === "model") {
          // Models must have a make as parent
          if (parent.subType !== "make") {
            return res.status(400).json({
              success: false,
              message: "Model categories must have a make category as parent.",
            });
          }
          // Ensure parent make has the same vehicleType
          const currentVehicleType =
            vehicleType !== undefined ? vehicleType : category.vehicleType;
          if (currentVehicleType && parent.vehicleType !== currentVehicleType) {
            return res.status(400).json({
              success: false,
              message: `Model vehicle type (${currentVehicleType}) must match parent brand vehicle type (${
                parent.vehicleType || "none"
              }).`,
            });
          }
        }
      }

      category.parentCategory = parentCategory || null;
    }
    if (isActive !== undefined) category.isActive = isActive;
    if (order !== undefined) category.order = order;

    // Check for duplicates before saving (if name or vehicleType changed)
    if (name !== undefined || vehicleType !== undefined) {
      const checkQuery = {
        name: category.name.trim(),
        type: category.type,
        _id: { $ne: category._id }, // Exclude current category
      };
      if (category.subType) checkQuery.subType = category.subType;
      if (category.vehicleType) checkQuery.vehicleType = category.vehicleType;
      if (category.parentCategory)
        checkQuery.parentCategory = category.parentCategory;

      const duplicate = await Category.findOne(checkQuery);
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `Category "${category.name}" already exists${
            category.vehicleType ? ` for ${category.vehicleType}` : ""
          }.`,
        });
      }
    }

    await category.save();

    return res.status(200).json({
      success: true,
      message: "Category updated successfully.",
      data: category,
    });
  } catch (error) {
    Logger.error("Update Category Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Delete Category
 */
export const deleteCategory = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete categories.",
      });
    }

    const { categoryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID.",
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    await category.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully.",
    });
  } catch (error) {
    Logger.error("Delete Category Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
