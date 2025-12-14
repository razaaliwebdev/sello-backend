import nodemailer from 'nodemailer';

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
        console.error("❌ SMTP Configuration Error:", errorMsg);
        throw new Error(errorMsg);
    }

    const transporter = nodemailer.createTransport(
        {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_MAIL,
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
        throw new Error("SMTP server configuration is invalid: " + verifyError.message);
    }

    const mailOptions = {
        from: `"${process.env.SITE_NAME || 'Sello'}" <${process.env.SMTP_MAIL}>`,
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
        if (sendError.code === 'EAUTH') {
            errorMessage = "SMTP authentication failed. Please check your email credentials.";
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
