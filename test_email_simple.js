import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    console.log("--- SIMPLIFIED EMAIL TEST ---");
    console.log("1. Reading .env...");
    const user = process.env.SMTP_MAIL?.match(/<(.+)>/)?.[1] || process.env.SMTP_MAIL;
    const pass = process.env.SMTP_PASSWORD;
    const host = process.env.SMTP_HOST;
    
    console.log(`   User: ${user}`);
    console.log(`   Pass: ${pass ? '******' : 'NOT SET'}`);
    console.log(`   Host: ${host}`);

    console.log("2. Creating Transporter...");
    const transporter = nodemailer.createTransport({
        host: host,
        port: 587,
        secure: false,
        auth: { user, pass },
        tls: { rejectUnauthorized: false }
    });

    console.log("3. Verifying Connection (Login)...");
    try {
        await transporter.verify();
        console.log("   ✅ SUCCESS! Credentials are correct.");
    } catch (err) {
        console.log("   ❌ FAILED! Connection rejected.");
        console.log("   Error:", err.message);
        if (err.responseCode === 535) {
            console.log("\n   !!! BAD CREDENTIALS !!!");
            console.log("   Use an APP PASSWORD.");
        }
    }
}

test();
