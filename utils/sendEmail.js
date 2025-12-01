import nodemailer from 'nodemailer';

const sendEmail = async (to, subject, html) => {
    // Validate email configuration
    const missingVars = [];
    if (!process.env.SMTP_HOST) missingVars.push('SMTP_HOST');
    if (!process.env.SMTP_PORT) missingVars.push('SMTP_PORT');
    if (!process.env.SMTP_MAIL) missingVars.push('SMTP_MAIL');
    if (!process.env.SMTP_PASSWORD) missingVars.push('SMTP_PASSWORD');
    
    if (missingVars.length > 0) {
        // In development mode or if not production, log to console instead of failing
        const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || process.env.NODE_ENV === 'dev';
        
        if (isDevelopment) {
            console.log("\n⚠️  =============================================");
            console.log("⚠️  SMTP NOT CONFIGURED - DEVELOPMENT MODE");
            console.log("⚠️  =============================================");
            console.log("📧 Email To:", to);
            console.log("📝 Subject:", subject);
            
            // Extract OTP from HTML if it's a password reset email
            const otpMatch = html.match(/\d{4}/);
            if (otpMatch) {
                console.log("🔑 OTP CODE:", otpMatch[0]);
                console.log("\n⚠️  IMPORTANT: Email not sent. Use the OTP code above for testing.");
            }
            
            console.log("\n📝 To configure SMTP (for production), add to server/.env:");
            console.log(`   SMTP_HOST=smtp.gmail.com`);
            console.log(`   SMTP_PORT=587`);
            console.log(`   SMTP_MAIL=your-email@gmail.com`);
            console.log(`   SMTP_PASSWORD=your-app-password`);
            console.log("⚠️  =============================================\n");
            
            return { messageId: 'dev-mode', accepted: [to] };
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
        console.log("✓ SMTP server is ready to send emails");
    } catch (verifyError) {
        console.error("❌ SMTP verification failed:", verifyError.message);
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
        console.log(`✓ Email sent successfully to ${to}. Message ID: ${info.messageId}`);
        return info;
    } catch (sendError) {
        console.error("❌ Failed to send email:", sendError.message);
        console.error("Error details:", sendError);
        
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
