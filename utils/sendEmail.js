import nodemailer from 'nodemailer';

const sendEmail = async (to, subject, html) => {
    // Validate email configuration
    if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_MAIL || !process.env.SMTP_PASSWORD) {
        throw new Error("Email configuration is missing. Please check SMTP settings in environment variables.");
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

    const info = await transporter.sendMail(mailOptions);
    console.log(`✓ Email sent successfully to ${to}. Message ID: ${info.messageId}`);
    
    return info;
};

export default sendEmail;
