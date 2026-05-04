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
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

window.SIH.slugify = function(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 90);
};

window.SIH.getClient = function() {
  const config = window.SIH_COMMUNITY_CONFIG;
  if (!config || !config.SUPABASE_URL || !config.SUPABASE_KEY) throw new Error("Missing Supabase config.");
  return supabase.createClient(config.SUPABASE_URL, config.SUPABASE_KEY);
};

window.SIH.getQueryParam = function(name) {
  return new URLSearchParams(window.location.search).get(name);
};

window.SIH.extractIdFromPathOrQuery = function() {
  const id = window.SIH.getQueryParam("id");
  if (id) return Number(id);
  const parts = window.location.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "";
  const match = last.match(/-(\d+)$/);
  return match ? Number(match[1]) : null;
};

window.SIH.makePostUrl = function(post) {
  const slug = post.slug || window.SIH.slugify(post.title || "discussion");
  return `/community/post/${slug}-${post.id}/`;
};

window.SIH.makeCategoryUrl = function(category) {
  return `/community/category/?slug=${window.SIH.slugify(category)}`;
};

window.SIH.makeProfileUrl = function(name) {
  return `/community/profile/?user=${encodeURIComponent(name || "Community Member")}`;
};

window.SIH.generateLocalSummary = function(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "This discussion is collecting practical implementation advice from the community.";
  return clean.length > 235 ? `${clean.slice(0, 235)}...` : clean;
};

window.SIH.extractTools = function(text) {
  const tools = [
    "ChatGPT", "Claude", "Gemini", "Canva", "Zapier", "Make", "n8n", "HubSpot",
    "Notion", "Airtable", "Shopify", "Etsy", "Klaviyo", "Mailchimp", "ConvertKit",
    "Printify", "Printful", "CapCut", "Pinterest", "Google Analytics",
    "Search Console", "Supabase", "Netlify", "WordPress", "Squarespace", "Wix"
  ];
  const haystack = String(text || "").toLowerCase();
  return tools.filter(tool => haystack.includes(tool.toLowerCase()));
};

window.SIH.recommendTools = function(post) {
  const text = `${post.title || ""} ${post.content || ""} ${post.category || ""} ${post.business_outcome || ""}`.toLowerCase();
  const recs = [];

  if (text.includes("etsy") || text.includes("listing") || text.includes("mockup")) {
    recs.push({ tool: "ChatGPT", reason: "Listing drafts, customer reply templates, SEO brainstorming" });
    recs.push({ tool: "Canva", reason: "Product mockups, social graphics, brand templates" });
    recs.push({ tool: "Zapier", reason: "Simple workflow automation between forms, email, and spreadsheets" });
  }

  if (text.includes("crm") || text.includes("lead") || text.includes("follow")) {
    recs.push({ tool: "HubSpot", reason: "CRM, lead tracking, pipeline visibility" });
    recs.push({ tool: "Zapier", reason: "Lead routing and follow-up automation" });
  }

  if (text.includes("automation") || text.includes("workflow")) {
    recs.push({ tool: "Make", reason: "Visual automation workflows with more control" });
    recs.push({ tool: "n8n", reason: "Advanced automation for technical users" });
  }

  if (!recs.length) {
    recs.push({ tool: "ChatGPT", reason: "Start with workflow mapping, templates, and implementation planning" });
  }

  return [...new Map(recs.map(item => [item.tool, item])).values()].slice(0, 5);
};

window.SIH.implementationFramework = function(post) {
  const outcome = post.business_outcome || "Save time";
  return [
    { label: "Goal", value: outcome },
    { label: "Start with", value: "Document the manual workflow before adding tools." },
    { label: "First automation", value: "Automate one repeatable step with low risk." },
    { label: "Measure", value: "Track time saved, response speed, or leads captured." }
  ];
};

window.SIH.schemaScript = function(data) {
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
};
