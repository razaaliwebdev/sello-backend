import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
  console.log('=== Current .env file content ===');
  console.log(envContent);
  console.log('\n=== Checking for issues ===');
  
  if (envContent.includes('meet.google.com')) {
    console.log('❌ FOUND: Google Meet URL in .env file!');
    console.log('This needs to be removed or changed to your frontend URL.');
  } else {
    console.log('✅ No Google Meet URL found');
  }
  
  if (!envContent.includes('CLIENT_URL=')) {
    console.log('⚠️  CLIENT_URL not set - will use default http://localhost:5173');
  } else {
    const clientUrlMatch = envContent.match(/CLIENT_URL=(.+)/);
    if (clientUrlMatch) {
      const url = clientUrlMatch[1].trim();
      console.log('CLIENT_URL is set to:', url);
      if (url.includes('meet.google.com')) {
        console.log('❌ CLIENT_URL is set to Google Meet! This is the problem!');
      }
    }
  }
} else {
  console.log('❌ .env file not found');
}
