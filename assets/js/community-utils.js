window.SIH = window.SIH || {};

window.SIH.escapeHtml = function(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

window.SIH.formatText = function(value) {
  return window.SIH.escapeHtml(value || "").replace(/\n/g, "<br>");
};

window.SIH.formatDate = function(value) {
  if (!value) return "Just now";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

window.SIH.slugify = function(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 90);
};

window.SIH.generateLocalSummary = function(text) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "This discussion is collecting practical implementation advice from the community.";
  return clean.length > 210 ? `${clean.slice(0, 210)}...` : clean;
};

window.SIH.extractTools = function(text) {
  const tools = [
    "ChatGPT", "Claude", "Gemini", "Canva", "Zapier", "Make", "n8n",
    "HubSpot", "Notion", "Airtable", "Shopify", "Etsy", "Klaviyo",
    "Mailchimp", "ConvertKit", "Printify", "Printful", "CapCut",
    "Pinterest", "Google Analytics", "Search Console", "Supabase"
  ];

  const haystack = String(text || "").toLowerCase();
  return tools.filter(tool => haystack.includes(tool.toLowerCase()));
};

window.SIH.getClient = function() {
  const config = window.SIH_COMMUNITY_CONFIG;
  if (!config || !config.SUPABASE_URL || !config.SUPABASE_KEY) {
    throw new Error("Missing Supabase config.");
  }
  return supabase.createClient(config.SUPABASE_URL, config.SUPABASE_KEY);
};

window.SIH.getQueryParam = function(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
};
