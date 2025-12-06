import { OAuth2Client } from 'google-auth-library';

// Use environment variable or fallback to the same client ID as frontend
const googleClientId = process.env.GOOGLE_CLIENT_ID || "90770038046-jpumef82nch1o3amujieujs2m1hr73rt.apps.googleusercontent.com";

// Warn if using fallback (development only)
if (!process.env.GOOGLE_CLIENT_ID && process.env.NODE_ENV !== 'production') {
    console.warn("⚠️ GOOGLE_CLIENT_ID not set in environment variables. Using fallback client ID.");
    console.warn("⚠️ For production, set GOOGLE_CLIENT_ID in your .env file.");
}

const client = new OAuth2Client(googleClientId);

export default client;
