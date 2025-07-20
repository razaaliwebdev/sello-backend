import nodemailer from 'nodemailer';

const sendEmail = async (to, subject, html) => {
    const transporter = nodemailer.createTransport(
        {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            auth: {
                user: process.env.SMTP_MAIL,
                pass: process.env.SMTP_PASSWORD
            }
        }
    );

    await transporter.sendMail(
        {
            from: process.env.SMTP_MAIL,
            to,
            subject,
            html
        }
    );
};

export default sendEmail;
