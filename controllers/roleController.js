import Role from '../models/roleModel.js';
import User from '../models/userModel.js';
import Invite from '../models/inviteModel.js';
import { createAuditLog } from '../utils/auditLogger.js';
import sendEmail from '../utils/sendEmail.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Role presets based on requirements
const ROLE_PRESETS = {
    "Super Admin": {
        name: "Super Admin",
        displayName: "Super Admin",
        accessLevel: "FULL",
        purpose: "Full access - Unrestricted system control; manage platform, teams, operations and security",
        permissions: {
            manageUsers: true,
            createRoles: true,
            editRoles: true,
            deleteRoles: true,
            inviteUsers: true,
            resetPasswords: true,
            viewListings: true,
            approveListings: true,
            editListings: true,
            deleteListings: true,
            featureListings: true,
            viewDealers: true,
            approveDealers: true,
            editDealers: true,
            manageDealerSubscriptions: true,
            viewDealerPerformance: true,
            manageBlogs: true,
            publishBlogs: true,
            moderateComments: true,
            managePromotions: true,
            createPushNotifications: true,
            sendPushNotifications: true,
            accessChatbot: true,
            viewChatbotLogs: true,
            manageSupportTickets: true,
            respondToInquiries: true,
            escalateIssues: true,
            managePlatformSettings: true,
            manageLogo: true,
            manageLanguage: true,
            manageCurrency: true,
            manageCommission: true,
            manageIntegrations: true,
            viewAnalytics: true,
            viewFinancialReports: true,
            exportReports: true,
            manageCategories: true,
            manageCarTypes: true,
            manageBanners: true,
            viewAuditLogs: true,
            viewUserProfiles: true,
            viewFullUserProfiles: true,
            accessSensitiveAreas: true
        },
        restrictions: [],
        isPreset: true
    },
    "Marketing Team": {
        name: "Marketing Team",
        displayName: "Marketing Team",
        accessLevel: "MEDIUM_HIGH",
        purpose: "Dealer access, handle normal users, manage blogs, edit posts, resolve issues",
        permissions: {
            viewDealers: true,
            approveDealers: true,
            editDealers: true,
            manageDealerSubscriptions: true,
            viewDealerPerformance: true,
            viewUserProfiles: true,
            manageBlogs: true,
            publishBlogs: true,
            editListings: true,
            moderateComments: true,
            managePromotions: true,
            manageSupportTickets: true,
            respondToInquiries: true,
            escalateIssues: true,
            manageCategories: true
        },
        restrictions: [
            "Cannot access financial reports or sensitive platform settings",
            "Cannot create or delete roles",
            "Cannot reset passwords or manage system integrations"
        ],
        isPreset: true
    },
    "Support Agent": {
        name: "Support Agent",
        displayName: "Support Agent",
        accessLevel: "MEDIUM",
        purpose: "Can access dealers and listings for support purposes",
        permissions: {
            viewDealers: true,
            editDealers: true,
            viewListings: true,
            editListings: true,
            accessChatbot: true,
            viewChatbotLogs: true,
            manageSupportTickets: true,
            respondToInquiries: true,
            escalateIssues: true
        },
        restrictions: [
            "Cannot approve dealers or listings",
            "Cannot manage users or financial data",
            "Cannot change role permissions or system settings"
        ],
        isPreset: true
    },
    "Blogs/Content Agent": {
        name: "Blogs/Content Agent",
        displayName: "Blogs/Content Agent",
        accessLevel: "MEDIUM",
        purpose: "Access blogs management, posts, upload banners, send notifications",
        permissions: {
            manageBlogs: true,
            publishBlogs: true,
            moderateComments: true,
            createPushNotifications: true,
            sendPushNotifications: true,
            managePromotions: true,
            manageCategories: true,
            manageBanners: true
        },
        restrictions: [
            "Cannot manage users, dealers or listings",
            "Cannot access financial data or sensitive platform settings",
            "Cannot change role permissions"
        ],
        isPreset: true
    }
};

/**
 * Initialize default roles
 */
export const initializeRoles = async () => {
    try {
        for (const [key, preset] of Object.entries(ROLE_PRESETS)) {
            const existingRole = await Role.findOne({ name: preset.name });
            if (!existingRole) {
                await Role.create(preset);
                console.log(`✓ Initialized role: ${preset.name}`);
            }
        }
    } catch (error) {
        console.error("Initialize Roles Error:", error.message);
    }
};

/**
 * Get all roles
 */
export const getAllRoles = async (req, res) => {
    try {
        // Only admin can view roles
        if (req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only admin can view roles."
            });
        }

        const roles = await Role.find({ isActive: true }).sort({ name: 1 });

        return res.status(200).json({
            success: true,
            message: "Roles retrieved successfully.",
            data: roles
        });
    } catch (error) {
        console.error("Get All Roles Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get role by ID
 */
export const getRoleById = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only admin can view role details."
            });
        }

        const { roleId } = req.params;
        const role = await Role.findById(roleId);

        if (!role) {
            return res.status(404).json({
                success: false,
                message: "Role not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Role retrieved successfully.",
            data: role
        });
    } catch (error) {
        console.error("Get Role By ID Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Create role
 */
export const createRole = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only admin can create roles."
            });
        }

        const { name, displayName, accessLevel, purpose, permissions, restrictions } = req.body;

        if (!name || !displayName || !accessLevel || !purpose) {
            return res.status(400).json({
                success: false,
                message: "Name, displayName, accessLevel, and purpose are required."
            });
        }

        // Check if role name already exists
        const existingRole = await Role.findOne({ name });
        if (existingRole) {
            return res.status(400).json({
                success: false,
                message: "Role with this name already exists."
            });
        }

        const role = await Role.create({
            name,
            displayName,
            accessLevel,
            purpose,
            permissions: permissions || {},
            restrictions: restrictions || [],
            createdBy: req.user._id,
            updatedBy: req.user._id
        });

        await createAuditLog(req.user, "role_created", {
            roleId: role._id,
            roleName: role.name
        }, null, req);

        return res.status(201).json({
            success: true,
            message: "Role created successfully.",
            data: role
        });
    } catch (error) {
        console.error("Create Role Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update role
 */
export const updateRole = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only admin can update roles."
            });
        }

        const { roleId } = req.params;
        const { displayName, accessLevel, purpose, permissions, restrictions } = req.body;

        const role = await Role.findById(roleId);
        if (!role) {
            return res.status(404).json({
                success: false,
                message: "Role not found."
            });
        }

        // Prevent editing preset roles
        if (role.isPreset) {
            return res.status(400).json({
                success: false,
                message: "Cannot edit preset roles. Create a custom role instead."
            });
        }

        if (displayName) role.displayName = displayName;
        if (accessLevel) role.accessLevel = accessLevel;
        if (purpose) role.purpose = purpose;
        if (permissions) role.permissions = { ...role.permissions, ...permissions };
        if (restrictions) role.restrictions = restrictions;
        role.updatedBy = req.user._id;

        await role.save();

        await createAuditLog(req.user, "role_updated", {
            roleId: role._id,
            roleName: role.name
        }, null, req);

        return res.status(200).json({
            success: true,
            message: "Role updated successfully.",
            data: role
        });
    } catch (error) {
        console.error("Update Role Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete role
 */
export const deleteRole = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only admin can delete roles."
            });
        }

        const { roleId } = req.params;

        const role = await Role.findById(roleId);
        if (!role) {
            return res.status(404).json({
                success: false,
                message: "Role not found."
            });
        }

        // Prevent deleting preset roles
        if (role.isPreset) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete preset roles."
            });
        }

        // Check if any users are using this role
        const usersWithRole = await User.countDocuments({ roleId: roleId });
        if (usersWithRole > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete role. ${usersWithRole} user(s) are currently assigned this role.`
            });
        }

        role.isActive = false;
        await role.save();

        await createAuditLog(req.user, "role_deleted", {
            roleId: role._id,
            roleName: role.name
        }, null, req);

        return res.status(200).json({
            success: true,
            message: "Role deleted successfully."
        });
    } catch (error) {
        console.error("Delete Role Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Invite user
 */
export const inviteUser = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only admin can invite users."
            });
        }

        const { email, fullName, role, roleId, permissions, expirationDays, password, twoFactorCode } = req.body;

        if (!email || !fullName || !role) {
            return res.status(400).json({
                success: false,
                message: "Email, fullName, and role are required."
            });
        }

        // Log the invite
        await createAuditLog(req.user, "user_invited", {
            targetEmail: email,
            role: role
        }, null, req);

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User with this email already exists."
            });
        }

        // Check if pending invite exists
        const existingInvite = await Invite.findOne({
            email: email.toLowerCase(),
            status: "pending"
        });
        if (existingInvite && !existingInvite.isExpired()) {
            return res.status(400).json({
                success: false,
                message: "An active invite already exists for this email."
            });
        }

        // Get role permissions if roleId provided
        let rolePermissions = permissions || {};
        if (roleId && !permissions) {
            const roleData = await Role.findById(roleId);
            if (roleData) {
                rolePermissions = roleData.permissions;
            }
        } else if (role !== "Custom" && !permissions) {
            // Use preset permissions
            const preset = ROLE_PRESETS[role];
            if (preset) {
                rolePermissions = preset.permissions;
            }
        }

        // Generate token
        const token = Invite.generateToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (expirationDays || 7));

        const invite = await Invite.create({
            email: email.toLowerCase(),
            fullName,
            role,
            roleId: roleId || null,
            permissions: rolePermissions,
            token,
            expiresAt,
            invitedBy: req.user._id
        });

        // Send invite email
        const inviteUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/accept-invite/${token}`;
        const siteName = process.env.SITE_NAME || "Sello";
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Admin Panel Invitation</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">Admin Panel Invitation</h1>
                </div>
                <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
                    <p style="font-size: 16px; margin-top: 0;">Hello <strong>${fullName}</strong>,</p>
                    <p>You have been invited by <strong>${req.user.name}</strong> (${req.user.email}) to join the <strong>${siteName}</strong> Admin Panel as <strong>${role}</strong>.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${inviteUrl}" style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">Accept Invitation</a>
                    </div>
                    <p style="color: #666; font-size: 14px; margin-bottom: 0;">
                        <strong>Important:</strong> This invitation will expire on <strong>${expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>.
                    </p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px; margin-bottom: 0;">
                        If you didn't expect this invitation, you can safely ignore this email.
                    </p>
                </div>
            </body>
            </html>
        `;

        // Send email - ensure it's sent before returning success
        try {
            await sendEmail(email, `Invitation to join ${siteName} Admin Panel`, emailHtml);
            console.log(`✓ Invitation email sent successfully to ${email}`);
        } catch (emailError) {
            console.error("❌ Send Invite Email Error:", emailError.message);
            // Still return success but log the error
            // The invite is created, email failure shouldn't block the process
            // But we should notify about email failure
            return res.status(201).json({
                success: true,
                message: "Invitation created successfully, but email could not be sent. Please check email configuration.",
                warning: "Email sending failed: " + emailError.message,
                data: invite
            });
        }

        await createAuditLog(req.user, "user_invited", {
            inviteId: invite._id,
            email: invite.email,
            role: invite.role
        }, null, req);

        return res.status(201).json({
            success: true,
            message: "Invitation sent successfully.",
            data: invite
        });
    } catch (error) {
        console.error("Invite User Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get all invites
 */
export const getAllInvites = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only admin can view invites."
            });
        }

        const invites = await Invite.find()
            .populate('invitedBy', 'name email')
            .populate('acceptedBy', 'name email')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Invites retrieved successfully.",
            data: invites
        });
    } catch (error) {
        console.error("Get All Invites Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get permission matrix (for export)
 */
export const getPermissionMatrix = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only admin can export permission matrix."
            });
        }

        const roles = await Role.find({ isActive: true }).sort({ name: 1 });
        
        // Get all permission keys
        const permissionKeys = [
            "manageUsers", "createRoles", "editRoles", "deleteRoles", "inviteUsers", "resetPasswords",
            "viewListings", "approveListings", "editListings", "deleteListings", "featureListings",
            "viewDealers", "approveDealers", "editDealers", "manageDealerSubscriptions", "viewDealerPerformance",
            "manageBlogs", "publishBlogs", "moderateComments", "managePromotions", "createPushNotifications", "sendPushNotifications",
            "accessChatbot", "viewChatbotLogs", "manageSupportTickets", "respondToInquiries", "escalateIssues",
            "managePlatformSettings", "manageLogo", "manageLanguage", "manageCurrency", "manageCommission", "manageIntegrations",
            "viewAnalytics", "viewFinancialReports", "exportReports",
            "manageCategories", "manageCarTypes",
            "viewAuditLogs", "viewUserProfiles", "viewFullUserProfiles", "accessSensitiveAreas"
        ];

        const matrix = roles.map(role => {
            const row = {
                role: role.name,
                displayName: role.displayName,
                accessLevel: role.accessLevel,
                purpose: role.purpose
            };
            
            permissionKeys.forEach(key => {
                row[key] = role.permissions[key] || false;
            });
            
            return row;
        });

        return res.status(200).json({
            success: true,
            message: "Permission matrix retrieved successfully.",
            data: {
                matrix,
                roles: roles.map(r => ({
                    id: r._id,
                    name: r.name,
                    displayName: r.displayName,
                    accessLevel: r.accessLevel,
                    purpose: r.purpose,
                    restrictions: r.restrictions
                }))
            }
        });
    } catch (error) {
        console.error("Get Permission Matrix Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get invite details by token (public endpoint)
 */
export const getInviteByToken = async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Invite token is required."
            });
        }

        const invite = await Invite.findOne({ token })
            .populate('invitedBy', 'name email')
            .select('-token'); // Don't send token back

        if (!invite) {
            return res.status(404).json({
                success: false,
                message: "Invalid or expired invitation link."
            });
        }

        // Check if invite is expired
        if (invite.isExpired()) {
            invite.status = "expired";
            await invite.save({ validateBeforeSave: false });
            return res.status(400).json({
                success: false,
                message: "This invitation has expired. Please contact the administrator for a new invitation."
            });
        }

        // Check if already accepted
        if (invite.status === "accepted") {
            return res.status(400).json({
                success: false,
                message: "This invitation has already been accepted."
            });
        }

        // Check if cancelled
        if (invite.status === "cancelled") {
            return res.status(400).json({
                success: false,
                message: "This invitation has been cancelled."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Invite details retrieved successfully.",
            data: {
                email: invite.email,
                fullName: invite.fullName,
                role: invite.role,
                expiresAt: invite.expiresAt,
                invitedBy: invite.invitedBy
            }
        });
    } catch (error) {
        console.error("Get Invite By Token Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Accept invite and create user account (public endpoint)
 */
export const acceptInvite = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Invite token is required."
            });
        }

        if (!password || password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password is required and must be at least 6 characters long."
            });
        }

        const invite = await Invite.findOne({ token });

        if (!invite) {
            return res.status(404).json({
                success: false,
                message: "Invalid invitation link."
            });
        }

        // Check if invite is expired
        if (invite.isExpired()) {
            invite.status = "expired";
            await invite.save({ validateBeforeSave: false });
            return res.status(400).json({
                success: false,
                message: "This invitation has expired. Please contact the administrator for a new invitation."
            });
        }

        // Check if already accepted
        if (invite.status === "accepted") {
            return res.status(400).json({
                success: false,
                message: "This invitation has already been accepted."
            });
        }

        // Check if cancelled
        if (invite.status === "cancelled") {
            return res.status(400).json({
                success: false,
                message: "This invitation has been cancelled."
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: invite.email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "A user with this email already exists. Please login instead."
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user with admin role and permissions
        const user = await User.create({
            name: invite.fullName,
            email: invite.email.toLowerCase(),
            password: hashedPassword,
            role: "admin", // All invited users are admins
            adminRole: invite.role, // Store the specific admin role
            roleId: invite.roleId || null,
            permissions: invite.permissions || {},
            status: "active",
            verified: true,
            isEmailVerified: true,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(invite.fullName)}&background=4F46E5&color=fff`
        });

        // Update invite status
        invite.status = "accepted";
        invite.acceptedAt = new Date();
        invite.acceptedBy = user._id;
        await invite.save({ validateBeforeSave: false });

        // Generate JWT token
        const jwtToken = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Log the acceptance
        await createAuditLog(user, "invite_accepted", {
            inviteId: invite._id,
            role: invite.role
        }, null, req);

        return res.status(201).json({
            success: true,
            message: "Invitation accepted successfully. Your account has been created.",
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    avatar: user.avatar,
                    role: user.role,
                    adminRole: user.adminRole,
                    permissions: user.permissions,
                    status: user.status
                },
                token: jwtToken
            }
        });
    } catch (error) {
        console.error("Accept Invite Error:", error.message);
        
        // Handle duplicate email error
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "A user with this email already exists."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

