/*
  Seller Insider Hub Community Upgrade Schema

  Run this in Supabase SQL Editor.

  Safe for your current MVP:
  - adds columns if missing
  - creates category/profile/recommendation/moderation tables
*/

alter table posts add column if not exists slug text;
alter table posts add column if not exists excerpt text;
alter table posts add column if not exists subcategory text;
alter table posts add column if not exists author_avatar text;
alter table posts add column if not exists upvotes int default 0;
alter table posts add column if not exists comment_count int default 0;
alter table posts add column if not exists view_count int default 0;
alter table posts add column if not exists featured boolean default false;
alter table posts add column if not exists status text default 'published';
alter table posts add column if not exists seo_title text;
alter table posts add column if not exists seo_description text;
alter table posts add column if not exists ai_summary text;
alter table posts add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now());

alter table comments add column if not exists parent_comment_id bigint references comments(id) on delete cascade;
alter table comments add column if not exists upvotes int default 0;
alter table comments add column if not exists is_ai_generated boolean default false;

create table if not exists categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  slug text not null unique,
  description text,
  icon text,
  color text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique,
  avatar_url text,
  bio text,
  role text default 'member',
  reputation int default 0,
  expertise_tags text[],
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists ai_recommendations (
  id bigint generated always as identity primary key,
  post_id bigint references posts(id) on delete cascade,
  recommended_tool text,
  recommended_workflow text,
  affiliate_url text,
  confidence_score numeric,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists moderation_queue (
  id bigint generated always as identity primary key,
  post_id bigint references posts(id) on delete cascade,
  reason text,
  severity text,
  ai_notes text,
  status text default 'open',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

insert into categories (name, slug, description, icon, color)
values
('AI Implementation', 'ai-implementation', 'Practical questions about implementing AI into real workflows.', 'sparkles', '#c66f3f'),
('Etsy Seller AI', 'etsy-seller-ai', 'AI workflows for Etsy sellers, handmade businesses, listings, mockups, SEO, and support.', 'shop', '#d88953'),
('AI Automation', 'ai-automation', 'Zapier, Make, n8n, AI agents, and workflow automation.', 'flow', '#b46a45'),
('AI Marketing', 'ai-marketing', 'AI-powered content, email, Pinterest, SEO, and social workflows.', 'megaphone', '#d19a61'),
('Small Business Systems', 'small-business-systems', 'Operations, SOPs, tools, and repeatable business systems.', 'layers', '#94664d')
on conflict (slug) do nothing;

/*
  Optional sample seeded discussions.
  You can delete these later.
*/

insert into posts (title, content, category, author_name, ai_summary, slug, status, featured)
values
(
  'What AI stack are Etsy sellers using right now?',
  'I am trying to automate customer service, mockups, SEO, and email marketing for my Etsy shop. Curious what tools others are using.',
  'Etsy Seller AI',
  'Jennie',
  'Etsy sellers are looking for practical AI stacks that connect listing creation, mockups, SEO, customer service, and email follow-up without becoming too technical.',
  'what-ai-stack-are-etsy-sellers-using-right-now',
  'published',
  true
)
on conflict do nothing;
