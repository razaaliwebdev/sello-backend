import dotenv from 'dotenv';
dotenv.config();
import sendEmail from './utils/sendEmail.js';

console.log("--- Sello Diagnosis Tool ---");
console.log("Checking Environment Variables...");

const vars = [
'SMTP_HOST', 'SMTP_PORT', 'SMTP_MAIL', 'SMTP_PASSWORD',
'ENABLE_EMAIL_NOTIFICATIONS', 'CLIENT_URL', 'NODE_ENV',
'jwt_secret', 'JWT_SECRET'
];

vars.forEach(v => {
    const val = process.env[v];
    let status = 'NOT SET';
    if (val) {
        if (v.includes('PASSWORD') || v.includes('SECRET')) {
            status = 'Set (******)';
        } else {
            status = `Set (${val})`;
        }
    }
    console.log(`${v}: ${status}`);
});

if (process.env.SMTP_MAIL) {
    const raw = process.env.SMTP_MAIL;
    const parsed = raw.match(/<(.+)>/)?.[1] || raw;
    console.log(`\nDEBUG Parsing:`);
    console.log(`Raw SMTP_MAIL: "${raw}"`);
    console.log(`Parsed User:   "${parsed}"`);
}

console.log("\nTesting Email Configuration...");
try {
    // Attempt to verify transport connection first if possible, but sendEmail logic does it on call.
    // We send to a null address? sendEmail usually requires a valid to.
    // But we are testing configuration.
    
    // Check if we are in dev mode
    if (process.env.NODE_ENV !== 'production') {
        console.log("Note: In Development mode, sendEmail might mock the email.");
    }

    const result = await sendEmail('test@example.com', 'Test Email', '<p>Test</p>');
    console.log("Email Result:", JSON.stringify(result, null, 2));
} catch (error) {
    console.error("Email Failed:", error.message);
}

console.log("\nDiagnosis Complete.");
process.exit(0);
