/*
  Seller Insider Hub Community Config

  Replace these values with your actual Supabase values.

  IMPORTANT:
  Use your Publishable / anon key only.
  Never put secret keys in frontend code.
*/

window.SIH_COMMUNITY_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT-ID.supabase.co",
  SUPABASE_KEY: "PASTE-YOUR-PUBLISHABLE-ANON-KEY-HERE",

  // Set true after deploying the included Supabase Edge Function.
  USE_AI_MODERATION: false,

  // Example after Edge Function deploy:
  // AI_MODERATION_ENDPOINT: "https://YOUR-PROJECT-ID.supabase.co/functions/v1/moderate-post"
  AI_MODERATION_ENDPOINT: ""
};
