import User from '../models/userModel.js';
import Category from '../models/categoryModel.js';
import RefreshToken from '../models/refreshTokenModel.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { generateOtp } from '../utils/generateOtp.js';
import sendEmail from '../utils/sendEmail.js';
import client from '../config/googleClient.js';
import { uploadCloudinary } from '../utils/cloudinary.js';
import Logger from '../utils/logger.js';
import { 
    generateVerificationCode, 
    sendVerificationCode, 
    verifyCode, 
    createExpiryDate 
} from '../utils/phoneVerification.js';

/**
 * Generate Access Token (short-lived, 15 minutes)
 */
const generateAccessToken = (userId, email) => {
    return jwt.sign(
        { id: userId, email, type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
    );
};

/**
 * Generate Refresh Token (long-lived, 7 days)
 */
const generateRefreshToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Store Refresh Token in Database
 */
const storeRefreshToken = async (userId, refreshToken, userAgent, ipAddress) => {
    try {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

        await RefreshToken.create({
            token: refreshToken,
            userId: userId,
            expiresAt: expiresAt,
            userAgent: userAgent || null,
            ipAddress: ipAddress || null,
            isRevoked: false
        });
    } catch (error) {
        // Handle duplicate token error (shouldn't happen with crypto.randomBytes, but handle gracefully)
        if (error.code === 11000) {
            Logger.warn('Duplicate refresh token generated (extremely rare)', { userId });
            // Retry with a new token (though this should be extremely rare)
            throw new Error('Token generation conflict. Please try again.');
        }
        throw error;
    }
};

/**
 * Generate both tokens and store refresh token
 * Returns { accessToken, refreshToken }
 */
const generateTokens = async (userId, email, userAgent, ipAddress) => {
    const accessToken = generateAccessToken(userId, email);
    const refreshToken = generateRefreshToken();
    
    // Store refresh token in database
    await storeRefreshToken(userId, refreshToken, userAgent, ipAddress);
    
    return { accessToken, refreshToken };
};

/**
 * Legacy function for backward compatibility (now generates access token)
 * @deprecated Use generateTokens instead
 */
const generateToken = (userId, email) => {
    return generateAccessToken(userId, email);
};

/**
 * Validate Email Format
 */
const isValidEmail = (email) => {
    const emailRegex = /^\S+@\S+\.\S+$/;
    return emailRegex.test(email);
};

/**
 * Validate Password Strength
 */
const isValidPassword = (password) => {
    // At least 6 characters
    return password && password.length >= 6;
};

/**
 * Register Controller
 */
export const register = async (req, res) => {
    try {
        // Check if registration is allowed
        const Settings = (await import('../models/settingsModel.js')).default;
        const allowRegistrationSetting = await Settings.findOne({ key: 'allowRegistration' });
        const allowRegistration = allowRegistrationSetting === null || 
            allowRegistrationSetting.value === true || 
            allowRegistrationSetting.value === 'true' || 
            allowRegistrationSetting.value === 1 || 
            allowRegistrationSetting.value === '1';

        if (!allowRegistration) {
            return res.status(403).json({
                success: false,
                message: "Registration is currently disabled. Please contact support for assistance."
            });
        }

        const {
            name,
            email,
            password,
            role,
            // Dealer-specific fields
            dealerName,
            mobileNumber,
            whatsappNumber,
            country,
            state,
            city,
            area,
            vehicleTypes
        } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and password are required."
            });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address."
            });
        }

        if (!isValidPassword(password)) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long."
            });
        }

        // Check for avatar file (handles both single and multiple file uploads)
        const hasAvatar = req.file || (req.files && req.files.avatar && req.files.avatar[0]);
        if (!hasAvatar) {
            return res.status(400).json({
                success: false,
                message: "Avatar image is required."
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "User already exists with this email."
            });
        }

        // Upload avatar to Cloudinary
        // Handle both single file and files array
        const avatarFile = req.file || (req.files && req.files.avatar && req.files.avatar[0]);
        if (!avatarFile) {
            return res.status(400).json({
                success: false,
                message: "Avatar image is required."
            });
        }
        const avatarUrl = await uploadCloudinary(avatarFile.buffer);

        // Upload CNIC/Business License if provided (for dealers)
        let cnicUrl = null;
        if (role === "dealer" && req.files && req.files.cnicFile && req.files.cnicFile[0]) {
            cnicUrl = await uploadCloudinary(req.files.cnicFile[0].buffer);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Prepare user data
        const userData = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            avatar: avatarUrl,
            password: hashedPassword,
            role: role === "dealer" ? "dealer" : (role === "admin" ? "admin" : "individual"),
            status: "active",
            isEmailVerified: false
        };

        // Add dealer-specific information
        if (role === "dealer") {
            const {
                description,
                website,
                facebook,
                instagram,
                twitter,
                linkedin,
                establishedYear,
                employeeCount,
                specialties,
                languages,
                paymentMethods,
                services
            } = req.body;

            // Look up location category names from IDs
            let countryName = null;
            let stateName = null;
            let cityName = null;
            
            if (country && mongoose.Types.ObjectId.isValid(country)) {
                const countryCategory = await Category.findById(country);
                if (countryCategory && countryCategory.subType === 'country') {
                    countryName = countryCategory.name;
                }
            }
            
            if (state && mongoose.Types.ObjectId.isValid(state)) {
                const stateCategory = await Category.findById(state);
                if (stateCategory && stateCategory.subType === 'state') {
                    stateName = stateCategory.name;
                }
            }
            
            if (city && mongoose.Types.ObjectId.isValid(city)) {
                const cityCategory = await Category.findById(city);
                if (cityCategory && cityCategory.subType === 'city') {
                    cityName = cityCategory.name;
                }
            }

            // Build location string
            const locationParts = [];
            if (area) locationParts.push(area);
            if (cityName) locationParts.push(cityName);
            if (stateName) locationParts.push(stateName);
            if (countryName) locationParts.push(countryName);
            const fullLocation = locationParts.join(', ');

            // Validate and format social media URLs
            const validateUrl = (url, platform) => {
                if (!url || !url.trim()) return null;
                let urlStr = url.trim();
                // Add https:// if no protocol
                if (!urlStr.match(/^https?:\/\//i)) {
                    urlStr = `https://${urlStr}`;
                }
                // Basic URL validation
                try {
                    new URL(urlStr);
                    return urlStr;
                } catch (e) {
                    console.warn(`Invalid ${platform} URL: ${urlStr}`);
                    return null;
                }
            };

            // Check if auto-approve dealers is enabled
            const autoApproveDealersSetting = await Settings.findOne({ key: 'autoApproveDealers' });
            const autoApproveDealers = autoApproveDealersSetting && 
                (autoApproveDealersSetting.value === true || 
                 autoApproveDealersSetting.value === 'true' || 
                 autoApproveDealersSetting.value === 1 || 
                 autoApproveDealersSetting.value === '1');

            // Parse JSON strings if they exist
            let parsedSpecialties = [];
            let parsedLanguages = [];
            let parsedPaymentMethods = [];
            let parsedServices = [];

            try {
                if (specialties) {
                    if (typeof specialties === 'string') {
                        parsedSpecialties = JSON.parse(specialties);
                    } else if (Array.isArray(specialties)) {
                        parsedSpecialties = specialties;
                    } else {
                        parsedSpecialties = specialties.split(',').map(s => s.trim());
                    }
                }
            } catch (e) {
                parsedSpecialties = typeof specialties === 'string' ? specialties.split(',').map(s => s.trim()) : [];
            }

            try {
                if (languages) {
                    if (typeof languages === 'string') {
                        parsedLanguages = JSON.parse(languages);
                    } else if (Array.isArray(languages)) {
                        parsedLanguages = languages;
                    } else {
                        parsedLanguages = languages.split(',').map(l => l.trim());
                    }
                }
            } catch (e) {
                parsedLanguages = typeof languages === 'string' ? languages.split(',').map(l => l.trim()) : [];
            }

            try {
                if (paymentMethods) {
                    if (typeof paymentMethods === 'string') {
                        parsedPaymentMethods = JSON.parse(paymentMethods);
                    } else if (Array.isArray(paymentMethods)) {
                        parsedPaymentMethods = paymentMethods;
                    } else {
                        parsedPaymentMethods = paymentMethods.split(',').map(p => p.trim());
                    }
                }
            } catch (e) {
                parsedPaymentMethods = typeof paymentMethods === 'string' ? paymentMethods.split(',').map(p => p.trim()) : [];
            }

            try {
                if (services) {
                    if (typeof services === 'string') {
                        parsedServices = JSON.parse(services);
                    } else if (Array.isArray(services)) {
                        parsedServices = services;
                    } else {
                        parsedServices = services.split(',').map(s => s.trim());
                    }
                }
            } catch (e) {
                parsedServices = typeof services === 'string' ? services.split(',').map(s => s.trim()) : [];
            }

            userData.dealerInfo = {
                businessName: dealerName || name,
                businessLicense: cnicUrl || null,
                businessAddress: fullLocation || null,
                businessPhone: mobileNumber || null,
                whatsappNumber: whatsappNumber || null,
                // Store both IDs and names for location
                country: country || null,
                countryName: countryName || null,
                state: state || null,
                stateName: stateName || null,
                city: city || null,
                cityName: cityName || null,
                area: area || null,
                vehicleTypes: vehicleTypes || null,
                verified: autoApproveDealers, // Auto-approve if setting is enabled
                verifiedAt: autoApproveDealers ? new Date() : null,
                // Enhanced fields
                description: description || null,
                website: validateUrl(website, 'website'),
                socialMedia: {
                    facebook: validateUrl(facebook, 'facebook'),
                    instagram: validateUrl(instagram, 'instagram'),
                    twitter: validateUrl(twitter, 'twitter'),
                    linkedin: validateUrl(linkedin, 'linkedin')
                },
                establishedYear: establishedYear ? parseInt(establishedYear) : null,
                employeeCount: employeeCount || null,
                specialties: parsedSpecialties,
                languages: parsedLanguages,
                paymentMethods: parsedPaymentMethods,
                services: parsedServices,
                businessHours: {
                    monday: { open: "09:00", close: "18:00", closed: false },
                    tuesday: { open: "09:00", close: "18:00", closed: false },
                    wednesday: { open: "09:00", close: "18:00", closed: false },
                    thursday: { open: "09:00", close: "18:00", closed: false },
                    friday: { open: "09:00", close: "18:00", closed: false },
                    saturday: { open: "09:00", close: "18:00", closed: false },
                    sunday: { open: "09:00", close: "18:00", closed: false }
                },
                locations: [],
                showroomImages: [],
                certifications: [],
                totalCarsSold: 0,
                averageRating: 0,
                totalReviews: 0,
                monthlyInventory: 0,
                featured: false,
                subscriptionTier: "free"
            };
            // Also store in main user fields for easy access
            userData.phone = mobileNumber;
        }

        // Create user
        const user = await User.create(userData);

        // If dealer registration and not auto-approved, create admin notification
        if (role === "dealer" && !autoApproveDealers) {
            try {
                const Notification = (await import('../models/notificationModel.js')).default;
                const adminUsers = await User.find({ role: 'admin' }).select('_id');
                const siteName = process.env.SITE_NAME || 'Sello';
                const clientUrl = process.env.CLIENT_URL?.split(',')[0]?.trim() || 'http://localhost:3000';

                for (const admin of adminUsers) {
                    await Notification.create({
                        title: 'New Dealer Registration',
                        message: `${user.name} (${user.email}) has registered as a dealer. Business: ${userData.dealerInfo?.businessName || user.name}`,
                        type: 'info',
                        recipient: admin._id,
                        actionUrl: `${clientUrl}/admin/dealers?userId=${user._id}`,
                        actionText: 'Review Registration'
                    });
                }
            } catch (notifError) {
                Logger.error("Error creating admin notification for dealer registration", notifError, { userId: user._id, email: user.email });
                // Don't fail registration if notification fails
            }
        }

        // Generate both access and refresh tokens
        const userAgent = req.headers['user-agent'] || null;
        const ipAddress = req.ip || req.connection.remoteAddress || null;
        const { accessToken, refreshToken } = await generateTokens(user._id, user.email, userAgent, ipAddress);

        // Set access token in cookie as well (for compatibility)
        res.cookie('token', accessToken, {
            httpOnly: false, // Allow client-side access
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000 // 15 minutes (access token lifetime)
        });

        // Return response (exclude sensitive data)
        return res.status(201).json({
            success: true,
            message: "User registered successfully.",
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    avatar: user.avatar,
                    role: user.role,
                    status: user.status,
                    verified: user.verified,
                    isEmailVerified: user.isEmailVerified
                },
                token: accessToken, // For backward compatibility
                accessToken: accessToken,
                refreshToken: refreshToken
            }
        });
    } catch (error) {
        Logger.error("Register Error", error, { email: req.body?.email });

        // Handle duplicate email error
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "User already exists with this email."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Login Controller
 */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        // Check user status
        if (user.status === 'suspended') {
            return res.status(403).json({
                success: false,
                message: "Your account has been suspended. Please contact support."
            });
        }

        if (user.status === 'inactive') {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive. Please contact support to activate it."
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        // Check if email verification is required
        const Settings = (await import('../models/settingsModel.js')).default;
        const requireEmailVerificationSetting = await Settings.findOne({ key: 'requireEmailVerification' });
        const requireEmailVerification = requireEmailVerificationSetting && 
            (requireEmailVerificationSetting.value === true || 
             requireEmailVerificationSetting.value === 'true' || 
             requireEmailVerificationSetting.value === 1 || 
             requireEmailVerificationSetting.value === '1');

        // If email verification is required and user hasn't verified, block login
        if (requireEmailVerification && !user.isEmailVerified && user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Please verify your email address before logging in. Check your inbox for the verification email.",
                requiresEmailVerification: true
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save({ validateBeforeSave: false });

        // Generate both access and refresh tokens
        const userAgent = req.headers['user-agent'] || null;
        const ipAddress = req.ip || req.connection.remoteAddress || null;
        const { accessToken, refreshToken } = await generateTokens(user._id, user.email, userAgent, ipAddress);

        // Set access token in cookie as well (for compatibility)
        res.cookie('token', accessToken, {
            httpOnly: false, // Allow client-side access
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000 // 15 minutes (access token lifetime)
        });

        // Return response with both tokens
        return res.status(200).json({
            success: true,
            message: "User logged in successfully.",
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    avatar: user.avatar,
                    role: user.role,
                    status: user.status,
                    verified: user.verified,
                    isEmailVerified: user.isEmailVerified,
                    lastLogin: user.lastLogin,
                    adminRole: user.adminRole || null,
                    roleId: user.roleId || null,
                    permissions: user.permissions || {},
                    dealerInfo: user.dealerInfo || null
                },
                token: accessToken, // For backward compatibility
                accessToken: accessToken,
                refreshToken: refreshToken
            }
        });
    } catch (error) {
        Logger.error("Login Error", error, { email: req.body?.email });
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Forgot Password Controller
 */
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address."
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            // Don't reveal if user exists for security
            return res.status(200).json({
                success: true,
                message: "If an account exists with this email, an OTP has been sent."
            });
        }

        // Check user status
        if (user.status === 'suspended') {
            return res.status(403).json({
                success: false,
                message: "Your account has been suspended. Please contact support."
            });
        }

        // Generate and save OTP
        const otp = generateOtp();
        user.otp = otp.toString();
        user.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save({ validateBeforeSave: false });

        // Send OTP email
        const subject = "SELLO - Password Reset OTP";
        const html = `
<div style="font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #fffdf7 0%, #fff8e9 100%); padding: 40px 0; max-width: 600px; margin: auto;">
  <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(255, 166, 0, 0.15); border: 1px solid #fff0d0;">
    <div style="background: linear-gradient(135deg, #FFA602 0%, #FF6B00 100%); padding: 30px 20px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 36px; font-weight: 700; letter-spacing: -0.5px;">
        Password Reset - <span style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">SELLO</span> 🚗
      </h1>
      <div style="height: 4px; width: 80px; background: rgba(255,255,255,0.3); margin: 15px auto 0;"></div>
    </div>
    <div style="padding: 40px 30px;">
      <p style="font-size: 18px; color: #555; line-height: 1.6; margin-bottom: 25px;">
        Hi ${user.name || 'User'},<br>
        You requested to reset your password on <b style="color: #FF6B00;">SELLO</b>.
      </p>
      <p style="font-size: 17px; color: #444; line-height: 1.6;">
        Please use this One-Time Password to reset your password:
      </p>
      <div style="background: #fef9f0; border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center; border: 1px dashed #FFA602;">
        <div style="font-size: 38px; font-weight: 800; color: #FF6B00; letter-spacing: 6px; padding: 10px; font-family: monospace;">
          ${otp}
        </div>
      </div>
      <div style="display: flex; align-items: center; background: #f8f9ff; border-radius: 10px; padding: 16px; margin-top: 30px;">
        <div style="font-size: 24px; margin-right: 15px;">⏱️</div>
        <p style="font-size: 14px; color: #666; margin: 0;">
          <b>Important:</b> This code expires in <span style="color: #FF6B00;">10 minutes</span>.
          Never share this code with anyone.
        </p>
      </div>
    </div>
    <div style="background: #fafafa; padding: 25px; text-align: center; border-top: 1px solid #f0f0f0;">
      <p style="font-size: 18px; margin: 0 0 15px 0; color: #FF6B00; font-weight: 600;">
        Stay Secure!
      </p>
      <p style="margin: 8px 0; font-size: 14px; color: #888;">
        The SELLO Team
      </p>
      <p style="margin: 20px 0 0; font-size: 12px; color: #aaa;">
        © ${new Date().getFullYear()} SELLO Automotive Marketplace. All rights reserved.
      </p>
    </div>
  </div>
</div>
        `;

        try {
            const emailResult = await sendEmail(user.email, subject, html);

            // If email wasn't actually sent (dev mode), log it but still return success
            const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || process.env.NODE_ENV === 'dev';
            if (emailResult?.messageId === 'dev-mode') {
                // OTP saved, email not sent in dev mode
            }
        } catch (emailError) {
            Logger.error("Email sending error", emailError, { email: user.email });

            // Check if SMTP is not configured
            const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || process.env.NODE_ENV === 'dev';
            const isMissingSMTP = emailError.message.includes("Email configuration is missing");

            // If SMTP is missing and we're in development, still return success
            if (isMissingSMTP && isDevelopment) {
                // Continue - don't return error
            } else if (isMissingSMTP) {
                // Production mode but SMTP not configured - still return success since OTP is saved in DB
            } else {
                // Other email errors - clear OTP and return error
                user.otp = null;
                user.otpExpiry = null;
                await user.save({ validateBeforeSave: false });

                // Pass the actual error message to the client
                let errorMessage = emailError.message || "Failed to send OTP.";
                let statusCode = 500;
                
                // If it's the specific App Password error, make sure it's clear and return 502
                if (emailError.message.includes("App Password") || emailError.message.includes("authentication failed")) {
                   errorMessage = "Email failed: " + emailError.message;
                   statusCode = 502; // Bad Gateway (Upstream error)
                } else if (emailError.message.includes("SMTP")) {
                    statusCode = 500; // Internal Server Error
                }

                return res.status(statusCode).json({
                    success: false,
                    message: errorMessage,
                    error: isDevelopment ? emailError.message : undefined
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: "If an account exists with this email, an OTP has been sent."
        });
    } catch (error) {
        Logger.error("Forgot Password Error", error, { email: req.body?.email });
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Verify OTP Controller
 */
export const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const email = req.headers.email;

        if (!otp) {
            return res.status(400).json({
                success: false,
                message: "OTP is required."
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required in headers."
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        // Check if OTP exists and is valid
        if (!user.otp || user.otp !== otp.toString()) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP."
            });
        }

        // Check if OTP is expired
        if (Date.now() > user.otpExpiry) {
            user.otp = null;
            user.otpExpiry = null;
            await user.save({ validateBeforeSave: false });

            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new one."
            });
        }

        // OTP is valid - don't clear it yet, let reset-password handle it
        return res.status(200).json({
            success: true,
            message: "OTP verified successfully. You can now reset your password."
        });
    } catch (error) {
        Logger.error("Verify OTP Error", error, { email: req.headers?.email });
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Reset Password Controller
 */
export const resetPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        const email = req.headers.email;

        if (!newPassword) {
            return res.status(400).json({
                success: false,
                message: "New password is required."
            });
        }

        if (!isValidPassword(newPassword)) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long."
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required in headers."
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        // Verify OTP was verified (OTP should still exist)
        if (!user.otp) {
            return res.status(400).json({
                success: false,
                message: "Please verify OTP first."
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password and clear OTP
        user.password = hashedPassword;
        user.otp = null;
        user.otpExpiry = null;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Password updated successfully."
        });
    } catch (error) {
        Logger.error("Reset Password Error", error, { email: req.headers?.email });
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Google Login Controller
 */
export const googleLogin = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Google token is required."
            });
        }

        // Check if GOOGLE_CLIENT_ID is configured (use fallback in development)
        const googleClientId = process.env.GOOGLE_CLIENT_ID || "90770038046-jpumef82nch1o3amujieujs2m1hr73rt.apps.googleusercontent.com";

        if (!googleClientId) {
            Logger.error("GOOGLE_CLIENT_ID not configured", { error: "Missing environment variable" });
            return res.status(500).json({
                success: false,
                message: "Google authentication is not configured. Please contact support.",
                error: process.env.NODE_ENV === 'development' ? "GOOGLE_CLIENT_ID environment variable is missing" : undefined
            });
        }

        // Verify Google token
        let ticket;
        try {
            // Get the client ID (must match frontend)
            const googleClientId = process.env.GOOGLE_CLIENT_ID || "90770038046-jpumef82nch1o3amujieujs2m1hr73rt.apps.googleusercontent.com";

            // Verify the token - the audience must match the client ID used on frontend
            ticket = await client.verifyIdToken({
                idToken: token,
                audience: googleClientId,
            });
        } catch (verifyError) {
            const googleClientId = process.env.GOOGLE_CLIENT_ID || "90770038046-jpumef82nch1o3amujieujs2m1hr73rt.apps.googleusercontent.com";
            Logger.error("Google token verification error", verifyError, {
                code: verifyError.code,
                clientId: process.env.GOOGLE_CLIENT_ID ? "Set" : "Using fallback",
                expectedAudience: googleClientId
            });

            // Provide more specific error messages
            let errorMessage = "Google login failed. Please try again.";
            if (verifyError.message?.includes("Wrong number of segments")) {
                errorMessage = "Invalid token format. Please try logging in again.";
            } else if (verifyError.message?.includes("Token used too early") || verifyError.message?.includes("Token used too late")) {
                errorMessage = "Token has expired. Please try logging in again.";
            } else if (verifyError.message?.includes("Invalid token signature")) {
                errorMessage = "Token signature is invalid. Please try logging in again.";
            } else if (verifyError.message?.includes("Invalid audience")) {
                errorMessage = "Google OAuth configuration mismatch. Please contact support.";
                Logger.error("Google Client ID mismatch", { error: "Frontend and backend must use the same Google Client ID" });
            } else if (verifyError.message?.includes("Token expired")) {
                errorMessage = "Login session expired. Please try logging in again.";
            }

            return res.status(401).json({
                success: false,
                message: errorMessage,
                error: process.env.NODE_ENV === 'development' ? verifyError.message : undefined
            });
        }

        const payload = ticket.getPayload();
        const { email, name, picture } = payload;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Invalid Google token. Email not found."
            });
        }

        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                success: false,
                message: "MongoDB is not running. Please start MongoDB server and try again.",
                help: "On Windows: Open Services (services.msc) and start 'MongoDB Server', or run 'net start MongoDB' in Command Prompt (as Administrator)"
            });
        }

        // Find or create user
        let user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            // Create new user from Google
            // Generate a secure random password for Google OAuth users
            const randomPassword = 'google-oauth-' + crypto.randomBytes(32).toString('hex') + '-' + Date.now();

            try {
                user = await User.create({
                    name: name || email.split('@')[0],
                    email: email.toLowerCase(),
                    avatar: picture || `https://ui-avatars.com/api/?name=${encodeURIComponent((name || email.charAt(0)).toUpperCase())}`,
                    password: randomPassword, // Secure placeholder password
                    verified: true,
                    isEmailVerified: true,
                    status: 'active',
                    role: 'individual',
                    lastLogin: new Date()
                });
            } catch (createError) {
                Logger.error("Error creating user from Google", createError);
                // If user creation fails, check if it's a duplicate email error
                if (createError.code === 11000 || createError.message?.includes('duplicate')) {
                    // User might have been created between check and create
                    user = await User.findOne({ email: email.toLowerCase() });
                    if (!user) {
                        throw createError;
                    }
                } else {
                    throw createError;
                }
            }
        } else {
            // Update existing user
            if (picture && !user.avatar) {
                user.avatar = picture;
            }
            user.lastLogin = new Date();
            user.verified = true;
            user.isEmailVerified = true;
            await user.save({ validateBeforeSave: false });
        }

        // Check user status
        if (user.status === 'suspended') {
            return res.status(403).json({
                success: false,
                message: "Your account has been suspended. Please contact support."
            });
        }

        if (user.status === 'inactive') {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive. Please contact support to activate it."
            });
        }

        // Generate both access and refresh tokens
        const userAgent = req.headers['user-agent'] || null;
        const ipAddress = req.ip || req.connection.remoteAddress || null;
        const { accessToken, refreshToken } = await generateTokens(user._id, user.email, userAgent, ipAddress);

        // Set access token in cookie as well (for compatibility)
        res.cookie('token', accessToken, {
            httpOnly: false, // Allow client-side access
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000 // 15 minutes (access token lifetime)
        });

        return res.status(200).json({
            success: true,
            message: "Google login successful.",
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    avatar: user.avatar,
                    role: user.role,
                    status: user.status,
                    verified: user.verified,
                    isEmailVerified: user.isEmailVerified,
                    adminRole: user.adminRole,
                    roleId: user.roleId
                },
                token: accessToken, // For backward compatibility
                accessToken: accessToken,
                refreshToken: refreshToken
            }
        });
    } catch (error) {
        Logger.error("Google Login Error", error);

        // Provide more specific error messages
        let errorMessage = "Google login failed. Please try again.";
        let statusCode = 500;

        if (error.message?.includes("Token used too early")) {
            errorMessage = "Token is not yet valid. Please try again.";
            statusCode = 401;
        } else if (error.message?.includes("Token used too late") || error.message?.includes("Token expired")) {
            errorMessage = "Token has expired. Please try logging in again.";
            statusCode = 401;
        } else if (error.message?.includes("Invalid token signature")) {
            errorMessage = "Invalid token signature. Please try logging in again.";
            statusCode = 401;
        } else if (error.message?.includes("Wrong number of segments")) {
            errorMessage = "Invalid token format. Please try logging in again.";
            statusCode = 400;
        } else if (error.message?.includes("Invalid audience")) {
            errorMessage = "Google OAuth configuration error. Please contact support.";
            statusCode = 500;
        } else if (error.name === "MongoError" || error.name === "MongoServerError") {
            errorMessage = "Database error occurred. Please try again.";
            statusCode = 500;
        } else if (error.message?.includes("MongoDB") || error.message?.includes("connection") || error.message?.includes("ECONNREFUSED")) {
            errorMessage = "Database is not connected. Please make sure MongoDB is running (start MongoDB Compass or MongoDB service) and try again.";
            statusCode = 503;
        } else if (mongoose.connection.readyState !== 1) {
            errorMessage = "Database is not connected. Please make sure MongoDB is running and try again.";
            statusCode = 503;
        }

        return res.status(statusCode).json({
            success: false,
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Logout Controller
 */
export const logout = async (req, res) => {
    try {
        const refreshToken = req.body.refreshToken || req.query.refreshToken;
        
        // If refresh token is provided, revoke it
        if (refreshToken) {
            await RefreshToken.updateOne(
                { token: refreshToken, isRevoked: false },
                { 
                    isRevoked: true, 
                    revokedAt: new Date() 
                }
            );
        } else if (req.user) {
            // If user is authenticated, revoke all their refresh tokens (optional - can be commented out)
            // This is useful for "logout from all devices" functionality
            // await RefreshToken.updateMany(
            //     { userId: req.user._id, isRevoked: false },
            //     { 
            //         isRevoked: true, 
            //         revokedAt: new Date() 
            //     }
            // );
        }

        // Clear cookie
        res.clearCookie('token');

        return res.status(200).json({
            success: true,
            message: "User logged out successfully."
        });
    } catch (error) {
        Logger.error("Logout Error", error, { userId: req.user?._id });
        return res.status(500).json({
            success: false,
            message: "Failed to log out.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Refresh Access Token Controller
 */
export const refreshToken = async (req, res) => {
    try {
        const { refreshToken: token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Refresh token is required."
            });
        }

        // Find refresh token in database
        const refreshTokenDoc = await RefreshToken.findOne({ 
            token: token,
            isRevoked: false
        }).populate('userId', '-password -otp -otpExpiry');

        if (!refreshTokenDoc) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired refresh token."
            });
        }

        // Check if token is expired (also handled by TTL index, but check here for immediate response)
        const now = new Date();
        if (refreshTokenDoc.expiresAt < now) {
            // Mark as revoked (TTL will delete it, but mark revoked for immediate cleanup)
            try {
                refreshTokenDoc.isRevoked = true;
                refreshTokenDoc.revokedAt = now;
                await refreshTokenDoc.save();
            } catch (saveError) {
                // Token might already be deleted by TTL, ignore save error
                Logger.debug('Token already expired/deleted by TTL', { tokenId: refreshTokenDoc._id });
            }
            
            return res.status(401).json({
                success: false,
                message: "Refresh token has expired."
            });
        }

        // Check if user still exists and is active
        const user = refreshTokenDoc.userId;
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User associated with refresh token not found."
            });
        }

        if (user.status === 'suspended' || user.status === 'inactive') {
            // Revoke all tokens for suspended/inactive users
            await RefreshToken.updateMany(
                { userId: user._id, isRevoked: false },
                { 
                    isRevoked: true, 
                    revokedAt: new Date() 
                }
            );
            
            return res.status(403).json({
                success: false,
                message: `Your account has been ${user.status}. Please contact support.`
            });
        }

        // Generate new access token
        const accessToken = generateAccessToken(user._id, user.email);

        // Set new access token in cookie
        res.cookie('token', accessToken, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000 // 15 minutes
        });

        return res.status(200).json({
            success: true,
            message: "Access token refreshed successfully.",
            data: {
                accessToken: accessToken,
                token: accessToken // For backward compatibility
            }
        });
    } catch (error) {
        Logger.error("Refresh Token Error", error);
        return res.status(500).json({
            success: false,
            message: "Failed to refresh token.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Send Phone Verification Code
 */
export const sendPhoneVerification = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: User not authenticated'
            });
        }

        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        // Validate phone number format (basic validation)
        if (!/^\+?\d{9,15}$/.test(phoneNumber.trim())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number format. Must be 9-15 digits.'
            });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Generate verification code
        const code = generateVerificationCode();
        const expiry = createExpiryDate();

        // Save code to user
        user.phone = phoneNumber.trim();
        user.phoneVerificationCode = code;
        user.phoneVerificationExpiry = expiry;
        user.phoneVerified = false; // Reset verified status when new code is sent
        await user.save();

        // Send SMS
        await sendVerificationCode(phoneNumber.trim(), code);

        return res.status(200).json({
            success: true,
            message: 'Verification code sent successfully. Please check your phone.'
        });
    } catch (error) {
        Logger.error("Send Phone Verification Error", error, { userId: req.user?._id });
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to send verification code',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Verify Phone Number
 */
export const verifyPhone = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: User not authenticated'
            });
        }

        const { code } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Verification code is required'
            });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!user.phoneVerificationCode || !user.phoneVerificationExpiry) {
            return res.status(400).json({
                success: false,
                message: 'No verification code found. Please request a new code.'
            });
        }

        // Verify code
        const isValid = verifyCode(user.phoneVerificationCode, code, user.phoneVerificationExpiry);

        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification code. Please request a new code.'
            });
        }

        // Mark phone as verified and clear code
        user.phoneVerified = true;
        user.phoneVerificationCode = null;
        user.phoneVerificationExpiry = null;
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Phone number verified successfully',
            data: {
                phone: user.phone,
                phoneVerified: user.phoneVerified
            }
        });
    } catch (error) {
        Logger.error("Verify Phone Error", error, { userId: req.user?._id });
        return res.status(500).json({
            success: false,
            message: 'Failed to verify phone number',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

