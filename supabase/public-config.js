// public-config.js
// Safe to expose the Supabase project URL and ANON key in the browser.
// NEVER put a service-role key or payment gateway secret here.
window.CAPITAL_CREW_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_PUBLIC_ANON_KEY",
  TERMS_VERSION: "1.0"
};
