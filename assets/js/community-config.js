/*
  Seller Insider Hub Community Config

  Replace these with your Supabase values.

  Use your Publishable / anon key only.
  Never put secret/service-role keys in frontend code.
*/

window.SIH_COMMUNITY_CONFIG = {
  SUPABASE_URL: "https://eeumxbvuntplhmwqlfyf.supabase.co",
  SUPABASE_KEY: "sb_publishable_nlNq13uE0hKeK6D6SBThVQ_tk0NA6Zv",

  // Keep false until you deploy the included Supabase Edge Function.
  USE_AI_MODERATION: true,

  // Example after Edge Function deploy:
  // AI_MODERATION_ENDPOINT: "https://YOUR-PROJECT-ID.supabase.co/functions/v1/moderate-post"
  AI_MODERATION_ENDPOINT: "https://eeumxbvuntplhmwqlfyf.supabase.co/functions/v1/moderate-post"
};
