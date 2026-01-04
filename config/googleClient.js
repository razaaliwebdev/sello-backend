import { OAuth2Client } from "google-auth-library";
import Logger from "../utils/logger.js";

// Google Client ID is required for Google OAuth to work
const googleClientId = process.env.GOOGLE_CLIENT_ID;

if (!googleClientId) {
  if (process.env.NODE_ENV === "production") {
    Logger.error("GOOGLE_CLIENT_ID is required in production", {
      error: "Missing required environment variable for Google OAuth",
    });
    throw new Error(
      "GOOGLE_CLIENT_ID environment variable is required in production"
    );
  } else {
    Logger.warn("GOOGLE_CLIENT_ID not set, Google OAuth will not work", {
      message: "Set GOOGLE_CLIENT_ID in your .env file to enable Google OAuth",
    });
  }
}

const client = new OAuth2Client(googleClientId);

export default client;
