import SubscriptionPlan from '../models/subscriptionPlanModel.js';
import Logger from '../utils/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';

/**
 * Get All Subscription Plans (Admin)
 */
export const getAllPlans = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can view all plans'
            });
        }

        const { includeInactive } = req.query;
        const query = includeInactive === 'true' ? {} : { isActive: true };

        const plans = await SubscriptionPlan.find(query)
            .sort({ order: 1, createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: plans
        });
    } catch (error) {
        Logger.error('Get All Plans Error', error, { userId: req.user?._id });
        return res.status(500).json({
            success: false,
            message: 'Server error fetching plans'
        });
    }
};

/**
 * Get Active Plans (Public)
 */
export const getActivePlans = async (req, res) => {
    try {
        // Get user role if authenticated
        const userRole = req.user?.role || 'user';
        
        // Find active and visible plans
        const plans = await SubscriptionPlan.find({ 
            isActive: true,
            visible: { $ne: false } // visible is true or undefined
        })
            .sort({ order: 1 })
            .select('-createdBy -updatedBy -createdAt -updatedAt');

        // Filter by role and user level
        const filteredPlans = plans.filter(plan => {
            // Check role access
            if (plan.allowedRoles && plan.allowedRoles.length > 0) {
                if (!plan.allowedRoles.includes('all') && !plan.allowedRoles.includes(userRole)) {
                    return false;
                }
            }
            
            // Check user level (if implemented)
            if (plan.minUserLevel && plan.minUserLevel > 0) {
                const userLevel = req.user?.level || 0;
                if (userLevel < plan.minUserLevel) {
                    return false;
                }
            }
            
            return true;
        });

        // Convert to object format for backward compatibility
        const plansObject = {};
        filteredPlans.forEach(plan => {
            plansObject[plan.name] = {
                name: plan.displayName,
                price: plan.price,
                duration: plan.duration,
                features: plan.features,
                maxListings: plan.maxListings,
                boostCredits: plan.boostCredits,
                requiresApproval: plan.requiresApproval || false
            };
        });

        return res.status(200).json({
            success: true,
            data: plansObject
        });
    } catch (error) {
        Logger.error('Get Active Plans Error', error);
        return res.status(500).json({
            success: false,
            message: 'Server error fetching plans'
        });
    }
};

/**
 * Get Single Plan
 */
export const getPlanById = async (req, res) => {
    try {
        const { planId } = req.params;

        const plan = await SubscriptionPlan.findById(planId);

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: plan
        });
    } catch (error) {
        Logger.error('Get Plan By ID Error', error, { userId: req.user?._id, planId: req.params.planId });
        return res.status(500).json({
            success: false,
            message: 'Server error fetching plan'
        });
    }
};

/**
 * Create Subscription Plan (Admin)
 */
export const createPlan = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can create plans'
            });
        }

        const {
            name,
            displayName,
            price,
            duration,
            features,
            maxListings,
            boostCredits,
            isActive,
            isDefault,
            order,
            description,
            visible,
            allowedRoles,
            minUserLevel,
            requiresApproval
        } = req.body;

        // Validation
        if (!name || !displayName || price === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Name, displayName, and price are required'
            });
        }

        // Check if plan name already exists
        const existingPlan = await SubscriptionPlan.findOne({ name });
        if (existingPlan) {
            return res.status(400).json({
                success: false,
                message: 'Plan with this name already exists'
            });
        }

        // If setting as default, unset other defaults
        if (isDefault) {
            await SubscriptionPlan.updateMany({ isDefault: true }, { isDefault: false });
        }

        const plan = new SubscriptionPlan({
            name,
            displayName,
            price: Number(price),
            duration: duration || 30,
            features: Array.isArray(features) ? features : [],
            maxListings: maxListings !== undefined ? Number(maxListings) : -1,
            boostCredits: boostCredits || 0,
            isActive: isActive !== undefined ? isActive : true,
            isDefault: isDefault || false,
            order: order || 0,
            description: description || "",
            createdBy: req.user._id,
            updatedBy: req.user._id
        });

        await plan.save();

        await createAuditLog(req.user, "plan_created", {
            planId: plan._id,
            planName: plan.name
        }, null, req);

        return res.status(201).json({
            success: true,
            message: 'Plan created successfully',
            data: plan
        });
    } catch (error) {
        Logger.error('Create Plan Error', error, { userId: req.user?._id });
        return res.status(500).json({
            success: false,
            message: 'Server error creating plan',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update Subscription Plan (Admin)
 */
export const updatePlan = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can update plans'
            });
        }

        const { planId } = req.params;
        const updateData = req.body;

        const plan = await SubscriptionPlan.findById(planId);
        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        // If setting as default, unset other defaults
        if (updateData.isDefault && !plan.isDefault) {
            await SubscriptionPlan.updateMany({ isDefault: true }, { isDefault: false });
        }

        // Update fields
        if (updateData.name && updateData.name !== plan.name) {
            const existingPlan = await SubscriptionPlan.findOne({ name: updateData.name });
            if (existingPlan && existingPlan._id.toString() !== planId) {
                return res.status(400).json({
                    success: false,
                    message: 'Plan with this name already exists'
                });
            }
        }

        Object.keys(updateData).forEach(key => {
            if (key === 'price' || key === 'duration' || key === 'maxListings' || key === 'boostCredits' || key === 'order' || key === 'minUserLevel') {
                plan[key] = Number(updateData[key]);
            } else if (key === 'features' && Array.isArray(updateData[key])) {
                plan[key] = updateData[key];
            } else if (key === 'allowedRoles' && Array.isArray(updateData[key])) {
                plan[key] = updateData[key].length > 0 ? updateData[key] : ["all"];
            } else if (key !== '_id' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'createdBy') {
                plan[key] = updateData[key];
            }
        });

        plan.updatedBy = req.user._id;
        await plan.save();

        await createAuditLog(req.user, "plan_updated", {
            planId: plan._id,
            planName: plan.name
        }, null, req);

        return res.status(200).json({
            success: true,
            message: 'Plan updated successfully',
            data: plan
        });
    } catch (error) {
        Logger.error('Update Plan Error', error, { userId: req.user?._id, planId: req.params.planId });
        return res.status(500).json({
            success: false,
            message: 'Server error updating plan',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete Subscription Plan (Admin)
 */
export const deletePlan = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can delete plans'
            });
        }

        const { planId } = req.params;

        const plan = await SubscriptionPlan.findById(planId);
        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        // Check if plan is being used (optional - you might want to prevent deletion if active subscriptions exist)
        // For now, we'll just delete it

        await SubscriptionPlan.findByIdAndDelete(planId);

        await createAuditLog(req.user, "plan_deleted", {
            planId: plan._id,
            planName: plan.name
        }, null, req);

        return res.status(200).json({
            success: true,
            message: 'Plan deleted successfully'
        });
    } catch (error) {
        Logger.error('Delete Plan Error', error, { userId: req.user?._id, planId: req.params.planId });
        return res.status(500).json({
            success: false,
            message: 'Server error deleting plan',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Toggle Plan Active Status (Admin)
 */
export const togglePlanStatus = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can toggle plan status'
            });
        }

        const { planId } = req.params;

        const plan = await SubscriptionPlan.findById(planId);
        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        plan.isActive = !plan.isActive;
        plan.updatedBy = req.user._id;
        await plan.save();

        await createAuditLog(req.user, "plan_status_toggled", {
            planId: plan._id,
            planName: plan.name,
            isActive: plan.isActive
        }, null, req);

        return res.status(200).json({
            success: true,
            message: `Plan ${plan.isActive ? 'activated' : 'deactivated'} successfully`,
            data: plan
        });
    } catch (error) {
        Logger.error('Toggle Plan Status Error', error, { userId: req.user?._id, planId: req.params.planId });
        return res.status(500).json({
            success: false,
            message: 'Server error toggling plan status'
        });
    }
};
