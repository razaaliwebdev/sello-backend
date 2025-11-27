import User from '../models/userModel.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { generateOtp } from '../utils/generateOtp.js';
import sendEmail from '../utils/sendEmail.js';
import client from '../config/googleClient.js';
import { uploadCloudinary } from '../utils/cloudinary.js';

/**
 * Generate JWT Token
 */
const generateToken = (userId, email) => {
    return jwt.sign(
        { id: userId, email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
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
        const { name, email, password, role } = req.body;

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

        if (!req.file) {
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
        const avatarUrl = await uploadCloudinary(req.file.buffer);

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            avatar: avatarUrl,
            password: hashedPassword,
            role: role === "seller" ? "seller" : "buyer",
            status: "active",
            isEmailVerified: false
        });

        // Generate token
        const token = generateToken(user._id, user.email);

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
                token
            }
        });
    } catch (error) {
        console.error("Register Error:", error.message);
        
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

        // Update last login
        user.lastLogin = new Date();
        await user.save({ validateBeforeSave: false });

        // Generate token
        const token = generateToken(user._id, user.email);

        // Return response
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
                    lastLogin: user.lastLogin
                },
                token
            }
        });
    } catch (error) {
        console.error("Login Error:", error.message);
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
        Hi ${user.name},<br>
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
            await sendEmail(user.email, subject, html);
        } catch (emailError) {
            console.error("Email sending error:", emailError);
            // Clear OTP if email fails
            user.otp = null;
            user.otpExpiry = null;
            await user.save({ validateBeforeSave: false });
            
            return res.status(500).json({
                success: false,
                message: "Failed to send OTP. Please try again later."
            });
        }

        return res.status(200).json({
            success: true,
            message: "If an account exists with this email, an OTP has been sent."
        });
    } catch (error) {
        console.error("Forgot Password Error:", error.message);
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
        console.error("Verify OTP Error:", error.message);
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
        console.error("Reset Password Error:", error.message);
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

        // Check if GOOGLE_CLIENT_ID is configured
        if (!process.env.GOOGLE_CLIENT_ID) {
            console.error("GOOGLE_CLIENT_ID is not configured in environment variables");
            return res.status(500).json({
                success: false,
                message: "Google authentication is not configured. Please contact support.",
                error: process.env.NODE_ENV === 'development' ? "GOOGLE_CLIENT_ID environment variable is missing" : undefined
            });
        }

        // Verify Google token
        let ticket;
        try {
            ticket = await client.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
        } catch (verifyError) {
            console.error("Google token verification error:", verifyError.message);
            return res.status(401).json({
                success: false,
                message: "Invalid Google token. Please try logging in again.",
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

        // Find or create user
        let user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            // Create new user from Google
            user = await User.create({
                name: name || email.split('@')[0],
                email: email.toLowerCase(),
                avatar: picture || `https://ui-avatars.com/api/?name=${encodeURIComponent((name || email.charAt(0)).toUpperCase())}`,
                password: 'google-auth-' + Date.now(), // Unique placeholder
                verified: true,
                isEmailVerified: true,
                status: 'active',
                role: 'buyer',
                lastLogin: new Date()
            });
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

        // Generate JWT token
        const jwtToken = generateToken(user._id, user.email);

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
                    isEmailVerified: user.isEmailVerified
                },
                token: jwtToken
            }
        });
    } catch (error) {
        console.error("Google Login Error:", error.message);
        console.error("Error details:", error);
        
        // Provide more specific error messages
        let errorMessage = "Invalid Google token or authentication failed.";
        
        if (error.message?.includes("Token used too early")) {
            errorMessage = "Token is not yet valid. Please try again.";
        } else if (error.message?.includes("Token used too late")) {
            errorMessage = "Token has expired. Please try logging in again.";
        } else if (error.message?.includes("Invalid token signature")) {
            errorMessage = "Invalid token signature. Please try logging in again.";
        } else if (error.message?.includes("Wrong number of segments")) {
            errorMessage = "Invalid token format. Please try logging in again.";
        }
        
        return res.status(401).json({
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
        // In a stateless JWT system, logout is handled client-side
        // But we can add token blacklisting here if needed in the future
        return res.status(200).json({
            success: true,
            message: "User logged out successfully."
        });
    } catch (error) {
        console.error("Logout Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to log out.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

