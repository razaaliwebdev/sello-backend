/**
 * Token Refresh Middleware
 * Automatically refreshes JWT tokens when they're about to expire
 * Prevents users from being logged out frequently
 */

import jwt from "jsonwebtoken";
import RefreshToken from "../models/refreshTokenModel.js";
import User from "../models/userModel.js";
import Logger from "./logger.js";

/**
 * Middleware to check token expiration and refresh if needed
 */
export const autoRefreshToken = async (req, res, next) => {
  try {
    // Skip for public routes
    if (
      req.path.includes("/auth/login") ||
      req.path.includes("/auth/register") ||
      req.path.includes("/auth/refresh") ||
      req.path.startsWith("/public") ||
      req.path === "/api/health"
    ) {
      return next();
    }

    const token =
      req.cookies?.token || req.headers?.authorization?.split(" ")[1];

    if (!token) {
      return next();
    }

    // Decode token without verification to check expiration
    const decoded = jwt.decode(token);

    if (!decoded || !decoded.exp) {
      return next();
    }

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;

    // If token expires in less than 5 minutes, refresh it
    if (timeUntilExpiry < 300 && timeUntilExpiry > 0) {
      const refreshToken = req.cookies?.refreshToken;

      if (refreshToken) {
        try {
          // Find refresh token in database
          const refreshTokenDoc = await RefreshToken.findOne({
            token: refreshToken,
            isRevoked: false,
          }).populate("userId", "-password -otp -otpExpiry");

          if (refreshTokenDoc && refreshTokenDoc.expiresAt > new Date()) {
            const user = refreshTokenDoc.userId;

            if (
              user &&
              user.status !== "suspended" &&
              user.status !== "inactive"
            ) {
              // Generate new access token
              const newAccessToken = jwt.sign(
                { id: user._id, email: user.email, type: "access" },
                process.env.JWT_SECRET,
                {
                  expiresIn:
                    process.env.JWT_ACCESS_EXPIRES_IN ||
                    (process.env.NODE_ENV === "production" ? "30m" : "15m"),
                }
              );

              // Set new token in cookie
              res.cookie("token", newAccessToken, {
                httpOnly: false,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge:
                  (process.env.NODE_ENV === "production" ? 30 : 15) * 60 * 1000,
              });

              // Update request token
              req.token = newAccessToken;
              req.headers.authorization = `Bearer ${newAccessToken}`;

              Logger.debug("Auto-refreshed token for user", {
                userId: user._id,
              });
            }
          }
        } catch (refreshError) {
          Logger.warn("Auto token refresh failed", refreshError);
          // Continue with original token
        }
      }
    }

    next();
  } catch (error) {
    Logger.error("Auto refresh middleware error", error);
    next();
  }
};

export default autoRefreshToken;
