import nodemailer from 'nodemailer';
import Logger from './logger.js';

const sendEmail = async (to, subject, html) => {
    // Check if email notifications are enabled
    const emailNotificationsEnabled = process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'false';
    
    if (!emailNotificationsEnabled) {
        Logger.warn('Email notifications disabled via ENABLE_EMAIL_NOTIFICATIONS', { to, subject });
        return { messageId: 'disabled', accepted: [to], actuallySent: false };
    }
    
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
        
        // Log the missing configuration
        Logger.warn('Email configuration missing', { missingVars });
        Logger.warn('Email will NOT be sent. Please configure SMTP in your .env file.', { 
            required: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_MAIL', 'SMTP_PASSWORD']
        });
        
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

    // Create transporter with improved configuration
    const transporterConfig = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
        auth: {
            user: emailUser,
            pass: process.env.SMTP_PASSWORD
        },
        tls: {
            rejectUnauthorized: false // Allow self-signed certificates
        },
        // Add connection timeout
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,
        socketTimeout: 10000
    };
    
    const transporter = nodemailer.createTransport(transporterConfig);

    // Verify transporter configuration (optional - skip if it fails, try sending anyway)
    try {
        await transporter.verify();
        Logger.info('SMTP connection verified successfully');
    } catch (verifyError) {
        Logger.warn('SMTP verification failed, but will attempt to send email anyway', { 
            error: verifyError.message 
        });
        
        // Only throw if it's a clear authentication error
        if (verifyError.responseCode === 535 || verifyError.message.includes("Invalid login") || verifyError.message.includes("authentication failed")) {
            Logger.error('CRITICAL SMTP ERROR: AUTHENTICATION FAILED', verifyError, {
                message: "Your email password was rejected. For Gmail: You MUST use a Gmail App Password (not your regular password).",
                instructions: [
                    "1. Enable 2-Step Verification on Google Account",
                    "2. Go to: https://myaccount.google.com/apppasswords",
                    "3. Generate App Password for 'Mail'",
                    "4. Update SMTP_PASSWORD in server/.env"
                ]
            });
            throw new Error("SMTP Authentication Failed: Invalid Password. Use an App Password for Gmail.");
        }
    }

    const mailOptions = {
        from: `"${process.env.SITE_NAME || 'Sello'}" <${emailUser}>`,
        to: to,
        subject: subject,
        html: html
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        
        // Log successful email send
        Logger.info('Email sent successfully', {
            to: to,
            subject: subject,
            messageId: info.messageId || 'unknown',
            accepted: info.accepted || [],
            rejected: info.rejected || []
        });
        
        // Ensure consistent return format
        return {
            messageId: info.messageId || `sent-${Date.now()}`,
            accepted: info.accepted || [to],
            rejected: info.rejected || [],
            actuallySent: true
        };
    } catch (sendError) {
        // Log the error with details
        Logger.error('Email sending failed', sendError, {
            to: to,
            subject: subject,
            errorCode: sendError.code,
            responseCode: sendError.responseCode
        });
        
        // Provide more specific error messages
        let errorMessage = "Failed to send email";
        if (sendError.code === 'EAUTH' || sendError.responseCode === 535) {
            errorMessage = "SMTP authentication failed. Please check your email credentials.";
            Logger.error('CRITICAL EMAIL ERROR: GMAIL AUTHENTICATION FAILED (535)', sendError, {
                message: "You are likely using your Login Password instead of an App Password.",
                instructions: [
                    "1. Go to Google Account > Security > 2-Step Verification > App Passwords",
                    "2. Generate a new password",
                    "3. Update SMTP_PASSWORD in server/.env"
                ],
                note: "Google requires an App Password for SMTP."
            });
        } else if (sendError.code === 'ECONNECTION') {
            errorMessage = "Could not connect to SMTP server. Please check SMTP_HOST and SMTP_PORT.";
        } else if (sendError.code === 'ETIMEDOUT') {
            errorMessage = "SMTP server connection timeout. Please try again later.";
        } else if (sendError.responseCode) {
            errorMessage = `SMTP server error: ${sendError.responseCode} - ${sendError.response || sendError.message}`;
        } else {
            errorMessage = sendError.message || "Failed to send email";
        }
        
        throw new Error(errorMessage);
    }
};

export default sendEmail;
