const { execSync } = require('child_process');

const envs = {
  VITE_SUPABASE_URL: "https://jchpigjboliantmslzwu.supabase.co",
  VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjaHBpZ2pib2xpYW50bXNsend1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODcyMzMsImV4cCI6MjA5MTY2MzIzM30.Fup1jte-9vGwBE3r_Z0gSyVsdtGShHQ47--ApxJCwj4",
  VITE_GEMINI_API_KEY: "AIzaSyC9i9Vr8GSmB_zVFZM9uIslWC4rOHVuysw"
};

for (const [key, val] of Object.entries(envs)) {
  console.log(`Removing old ${key} (if exists)...`);
  try {
    execSync(`npx vercel env rm ${key} production preview development --yes`, { stdio: 'ignore' });
  } catch (e) {
    // Ignore if not exists
  }
  
  for (const target of ['production', 'preview', 'development']) {
    console.log(`Adding ${key} to ${target}...`);
    try {
      execSync(`npx vercel env add ${key} ${target}`, { input: val });
      console.log(`Successfully added ${key} to ${target}`);
    } catch (e) {
      console.error(`Failed to add ${key} to ${target}:`, e.message);
    }
  }
}

console.log('Finished uploading Environment Variables!');
