/*
  Optional seeded discussions.
*/

insert into posts (title, slug, content, category, author_name, business_outcome, current_tools, ai_summary, seo_title, seo_description, status, featured)
values
(
  'What AI stack should an Etsy seller start with for listings, mockups, and customer messages?',
  'etsy-seller-ai-stack-listings-mockups-customer-messages',
  'I want a simple AI stack for an Etsy shop that helps with listing descriptions, SEO keywords, mockups, customer replies, and email follow-up without becoming too technical. What tools should come first?',
  'Etsy Seller AI',
  'Seller Insider Hub',
  'Save time',
  'Etsy, Canva, ChatGPT, Zapier',
  'A beginner Etsy AI stack should usually start with listing support, mockup creation, customer reply templates, and simple automation before adding more complex systems.',
  'AI stack for Etsy sellers: listings, mockups, and customer messages',
  'Discuss the best beginner AI stack for Etsy sellers who want help with listings, mockups, SEO, and customer messages.',
  'published',
  true
),
(
  'How should a small business choose between Zapier, Make, and n8n for AI automations?',
  'zapier-vs-make-vs-n8n-ai-automation-small-business',
  'I keep seeing Zapier, Make, and n8n recommended for AI workflows. How should a small business decide which one is easiest, which one is most powerful, and which one is worth learning first?',
  'AI Automation',
  'Seller Insider Hub',
  'Automation',
  'Zapier, Make, n8n, ChatGPT',
  'Zapier is usually easiest for beginners, Make offers more visual workflow control, and n8n can be powerful for technical users who want more flexibility.',
  'Zapier vs Make vs n8n for small business AI automation',
  'Community discussion comparing Zapier, Make, and n8n for small business AI automation workflows.',
  'published',
  true
)
on conflict do nothing;
