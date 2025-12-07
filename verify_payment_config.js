// Quick script to verify payment configuration
import dotenv from 'dotenv';
dotenv.config();

console.log('=== Payment Configuration Check ===\n');

const clientUrl = process.env.CLIENT_URL;
const stripeKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

console.log('CLIENT_URL:', clientUrl || 'NOT SET (will use default: http://localhost:5173)');
if (clientUrl) {
    if (clientUrl.includes('meet.google.com')) {
        console.log('❌ ERROR: CLIENT_URL contains Google Meet URL!');
        console.log('   This will cause payment redirects to go to Google Meet!');
        console.log('   Fix: Set CLIENT_URL=http://localhost:5173 in your .env file');
    } else {
        console.log('✅ CLIENT_URL looks correct');
    }
} else {
    console.log('⚠️  CLIENT_URL not set - using default http://localhost:5173');
}

console.log('\nSTRIPE_SECRET_KEY:', stripeKey ? `${stripeKey.substring(0, 20)}...` : 'NOT SET');
if (stripeKey && !stripeKey.startsWith('sk_')) {
    console.log('❌ ERROR: STRIPE_SECRET_KEY should start with sk_test_ or sk_live_');
}

console.log('\nSTRIPE_WEBHOOK_SECRET:', webhookSecret ? `${webhookSecret.substring(0, 20)}...` : 'NOT SET');
if (webhookSecret) {
    if (webhookSecret.startsWith('pk_')) {
        console.log('❌ ERROR: STRIPE_WEBHOOK_SECRET is a publishable key (pk_)!');
        console.log('   It should be a webhook secret (whsec_)');
        console.log('   Get it from: https://dashboard.stripe.com/test/webhooks');
    } else if (webhookSecret.startsWith('whsec_')) {
        console.log('✅ STRIPE_WEBHOOK_SECRET format looks correct');
    } else {
        console.log('⚠️  STRIPE_WEBHOOK_SECRET format unclear');
    }
}

console.log('\n=== Payment URLs that will be used ===');
console.log('Subscription Success:', `${clientUrl || 'http://localhost:5173'}/subscription/success`);
console.log('Boost Success:', `${clientUrl || 'http://localhost:5173'}/boost/success`);

console.log('\n✅ Configuration check complete!');
console.log('⚠️  Remember to RESTART your server after changing .env!');

