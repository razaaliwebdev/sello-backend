import nodemailer from 'nodemailer';
import Logger from './logger.js';

const sendEmail = async (to, subject, html) => {
    // Validate email configuration
    const missingVars = [];
    if (!process.env.SMTP_HOST) missingVars.push('SMTP_HOST');
    if (!process.env.SMTP_PORT) missingVars.push('SMTP_PORT');
    if (!process.env.SMTP_MAIL) missingVars.push('SMTP_MAIL');
    if (!process.env.SMTP_PASSWORD) missingVars.push('SMTP_PASSWORD');
    
    if (missingVars.length > 0) {
        // Check if we're in production - if so, we MUST have SMTP configured
        const isProduction = process.env.NODE_ENV === 'production';
        const isDevelopment = !isProduction;
        
        if (isDevelopment) {
            // Return a special marker so we know email wasn't actually sent
            return { messageId: 'dev-mode', accepted: [to], actuallySent: false };
        }
        
        // In production, throw error
        const errorMsg = `Email configuration is missing. Required environment variables: ${missingVars.join(', ')}`;
        Logger.error('SMTP Configuration Error', new Error(errorMsg), { missingVars });
        throw new Error(errorMsg);
    }

    const emailUser = process.env.SMTP_MAIL?.match(/<(.+)>/)?.[1] || process.env.SMTP_MAIL;

    const transporter = nodemailer.createTransport(
        {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
            auth: {
                user: emailUser,
                pass: process.env.SMTP_PASSWORD
            },
            tls: {
                rejectUnauthorized: false // Allow self-signed certificates
            }
        }
    );

    // Verify transporter configuration
    try {
        await transporter.verify();
    } catch (verifyError) {
        if (verifyError.responseCode === 535 || verifyError.message.includes("Invalid login")) {
            console.error("\n\n========================================================");
            console.error("CRITICAL SMTP ERROR: GMAIL AUTHENTICATION FAILED (535)");
            console.error("--------------------------------------------------------");
            console.error("Your Google Password was rejected.");
            console.error("You MUST use a Gmail App Password.");
            console.error("1. Enable 2-Step Verification on Google Account");
            console.error("2. Generating App Password");
            console.error("3. Update SMTP_PASSWORD in .env");
            console.error("See FIX_EMAIL_INSTRUCTIONS.md");
            console.error("========================================================\n\n");
            throw new Error("SMTP Authentication Failed: Invalid Password. Use an App Password.");
        }
        throw new Error("SMTP server configuration is invalid: " + verifyError.message);
    }

    const mailOptions = {
        from: `"${process.env.SITE_NAME || 'Sello'}" <${emailUser}>`,
        to: to,
        subject: subject,
        html: html
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        return { ...info, actuallySent: true }; // Mark as actually sent
    } catch (sendError) {
        
        // Provide more specific error messages
        let errorMessage = "Failed to send email";
        if (sendError.code === 'EAUTH' || sendError.responseCode === 535) {
            errorMessage = "SMTP authentication failed. Please check your email credentials.";
            console.error("\n\n========================================================");
            console.error("CRITICAL EMAIL ERROR: GMAIL AUTHENTICATION FAILED (535)");
            console.error("--------------------------------------------------------");
            console.error("You are likely using your Login Password instead of an App Password.");
            console.error("Google requires an App Password for SMTP.");
            console.error("1. Go to Google Account > Security > 2-Step Verification > App Passwords");
            console.error("2. Generate a new password");
            console.error("3. Update SMTP_PASSWORD in server/.env");
            console.error("See FIX_EMAIL_INSTRUCTIONS.md for details.");
            console.error("========================================================\n\n");
        } else if (sendError.code === 'ECONNECTION') {
            errorMessage = "Could not connect to SMTP server. Please check SMTP_HOST and SMTP_PORT.";
        } else if (sendError.code === 'ETIMEDOUT') {
            errorMessage = "SMTP server connection timeout. Please try again later.";
        } else if (sendError.responseCode) {
            errorMessage = `SMTP server error: ${sendError.responseCode} - ${sendError.response || sendError.message}`;
        }
        
        throw new Error(errorMessage);
    }
};

export default sendEmail;
